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

export async function POST(request: NextRequest) {
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

    // For seeking_alpha strategy: pre-filter to only include symbols in the SA list
    let saListSymbols: string[] | null = null;
    if (body.strategy === "seeking_alpha") {
      const saList = await loadSAList();
      saListSymbols = saList.symbols;
      const saSet = new Set(saListSymbols.map((s) => s.toUpperCase()));
      stocks = stocks.filter((s) => saSet.has(s.symbol.toUpperCase()));
      console.log(
        `[screener] Seeking Alpha: ${saListSymbols.length} symbols in list, ${stocks.length} found in pool`
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
