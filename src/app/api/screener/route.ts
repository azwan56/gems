// ============================================================
// POST /api/screener — Execute a stock screening query
//
// Data priority:
//   1. Firestore stock pool (persisted FMP data)
//   2. Mock data fallback (if pool is empty / Firestore unavailable)
//
// For seeking_alpha strategy:
//   Pre-filters pool to only include symbols in the SA custom list,
//   then applies the same growth filters as small_growth.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { ScreenerRequest } from "@/lib/types";
import { getStrategyPreset } from "@/lib/strategies";
import { executeScreener } from "@/lib/screener-engine";
import { loadStockPool } from "@/lib/stock-pool-store";
import { generateMockStocks } from "@/lib/mock-data";
import { loadSAList } from "@/lib/seeking-alpha-store";
import { requirePremium } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  try {
    const body: ScreenerRequest = await request.json();

    if (!body.strategy || !body.filters) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "strategy and filters are required" },
        { status: 400 }
      );
    }

    // Merge with preset defaults if no custom filters provided
    let filters = body.filters;
    if (filters.length === 0) {
      const preset = getStrategyPreset(body.strategy);
      if (preset) {
        filters = preset.defaultFilters;
      }
    }

    // Try loading from persisted stock pool first
    let stocks;
    let dataSource: "fmp" | "mock" = "mock";

    const pool = await loadStockPool();
    if (pool && pool.stocks.length > 0) {
      stocks = pool.stocks;
      dataSource = pool.meta.source;
      console.log(
        `[screener] Using ${dataSource} pool: ${stocks.length} stocks (updated ${pool.meta.updatedAt})`
      );
    } else {
      // Fallback to mock data
      stocks = generateMockStocks();
      console.log("[screener] Using mock data fallback");
    }

    // For seeking_alpha strategy: show all SA list symbols without filtering
    // Parallelized: load SA list and stock pool concurrently
    let saListSymbols: string[] | null = null;
    if (body.strategy === "seeking_alpha") {
      const [saList, saPool] = await Promise.all([loadSAList(), loadStockPool()]);
      saListSymbols = saList.symbols;
      const saSet = new Set(saListSymbols.map((s) => s.toUpperCase()));
      
      // Use already-loaded pool if available, otherwise use current stocks
      const poolStocks = (saPool && saPool.stocks.length > 0) ? saPool.stocks : stocks;
      
      // Find SA symbols that are already in the pool
      const inPool = poolStocks.filter((s) => saSet.has(s.symbol.toUpperCase()));
      const inPoolSet = new Set(inPool.map((s) => s.symbol.toUpperCase()));
      
      // Find SA symbols NOT in the pool — fetch from FMP on demand
      const missingSymbols = saListSymbols.filter(
        (s) => !inPoolSet.has(s.toUpperCase())
      );
      
      if (missingSymbols.length > 0) {
        console.log(
          `[screener] SA: ${missingSymbols.length} symbols not in pool, fetching on demand: ${missingSymbols.join(", ")}`
        );
        const { fetchOnDemandStocks } = await import("@/lib/fmp-client");
        const onDemand = await fetchOnDemandStocks(missingSymbols);
        console.log(`[screener] SA: fetched ${onDemand.length} on-demand stocks`);
        stocks = [...inPool, ...onDemand];
      } else {
        stocks = inPool;
      }
      
      console.log(
        `[screener] Seeking Alpha: ${saListSymbols.length} in list, ${stocks.length} with data`
      );
    }

    const screenerRequest: ScreenerRequest = {
      ...body,
      filters,
    };

    const result = executeScreener(stocks, screenerRequest);
    return NextResponse.json({
      ...result,
      dataSource,
      poolUpdatedAt: pool?.meta.updatedAt ?? null,
      ...(saListSymbols !== null ? { saListCount: saListSymbols.length } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "SCREENER_ERROR", message },
      { status: 500 }
    );
  }
}
