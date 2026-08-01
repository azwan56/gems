import { NextRequest, NextResponse } from "next/server";
import { getStrategyRoster } from "@/lib/strategy-roster-store";
import { STRATEGY_PRESETS } from "@/lib/strategies";
import { loadStockPool } from "@/lib/stock-pool-store";
import { saveAuditMetrics, AuditMetricsData } from "@/lib/audit-metrics-store";
import { getSelfHealingLogs, StrategyWinRate, PerformanceShowcaseStock } from "@/lib/audit-store";
import { fmpFetch, parallelBatchFetch } from "@/lib/fmp-fetch";

// Vercel max duration for heavy cron (5 mins)
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // ---- Security: verify Vercel cron secret ----
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const year = new Date().getFullYear();
    const pool = await loadStockPool();
    if (!pool) {
      return NextResponse.json({ error: "No stock pool data available" }, { status: 500 });
    }

    const currentPriceMap = new Map<string, number>();
    for (const s of pool.stocks) {
      currentPriceMap.set(s.symbol, s.price);
    }

    const winRates: StrategyWinRate[] = [];
    const allStocksShowcase: PerformanceShowcaseStock[] = [];

    // Collect all unique symbols across all rosters for bulk historical fetching
    const uniqueSymbols = new Set<string>();
    const rostersByStrategy = new Map<string, any[]>();

    for (const [strategyId, preset] of Object.entries(STRATEGY_PRESETS)) {
      if (strategyId === "seeking_alpha") continue;
      const roster = await getStrategyRoster(strategyId, year);
      if (roster && roster.entries.length > 0) {
        rostersByStrategy.set(strategyId, roster.entries);
        roster.entries.forEach(e => uniqueSymbols.add(e.symbol));
      }
    }

    // Fetch last 90 calendar days of prices for all unique symbols to cover T+60 trading days
    const { map: historicalMap } = await parallelBatchFetch(
      Array.from(uniqueSymbols),
      async (symbol) => {
        // Fetch up to 90 trading days to be safe
        const data = await fmpFetch<{ historical: Array<{ date: string; close: number; adjClose?: number }> }>(
          `/historical-price-full/${symbol}`,
          { timeseries: "90" },
          { revalidate: 86400 } // Cache for 24h
        );
        return { key: symbol, value: data?.historical || [] };
      },
      { batchSize: 5, delayMs: 1000 }
    );

    // Helper to get price N trading days after entryDate
    const getPriceTPlusN = (symbol: string, entryDate: string, n: number, fallbackPrice: number) => {
      const history = historicalMap.get(symbol);
      if (!history || history.length === 0) return fallbackPrice;
      
      // History is returned newest-first (descending date).
      // Find the index of the entry date.
      const entryIdx = history.findIndex(h => h.date <= entryDate);
      if (entryIdx === -1) return fallbackPrice; // Entry date too old or not found
      
      // Because array is newest-first, T+N is at index (entryIdx - N).
      const targetIdx = entryIdx - n;
      
      // If T+N hasn't happened yet (targetIdx < 0), we use the most recent price (index 0)
      if (targetIdx < 0) {
        return history[0].adjClose ?? history[0].close;
      }
      
      return history[targetIdx].adjClose ?? history[targetIdx].close;
    };

    // Calculate metrics per strategy
    for (const [strategyId, preset] of Object.entries(STRATEGY_PRESETS)) {
      if (strategyId === "seeking_alpha") continue;

      const entries = rostersByStrategy.get(strategyId) || [];
      if (entries.length === 0) {
        // Default empty win rate
        winRates.push({
          id: strategyId,
          name: preset.name,
          nameZh: preset.nameZh,
          t5WinRate: 0,
          t20WinRate: 0,
          t60WinRate: 0,
          avgReturn: 0,
          status: "WARNING",
          totalRecommendations: 0,
          iconName: preset.icon,
        });
        continue;
      }

      let t5Wins = 0, t20Wins = 0, t60Wins = 0;
      let totalReturn = 0;

      for (const entry of entries) {
        const entryPrice = entry.firstEntryPrice;
        const currentPrice = currentPriceMap.get(entry.symbol) || entryPrice;
        
        const priceT5 = getPriceTPlusN(entry.symbol, entry.firstEntryDate, 5, currentPrice);
        const priceT20 = getPriceTPlusN(entry.symbol, entry.firstEntryDate, 20, currentPrice);
        const priceT60 = getPriceTPlusN(entry.symbol, entry.firstEntryDate, 60, currentPrice);

        if (priceT5 > entryPrice) t5Wins++;
        if (priceT20 > entryPrice) t20Wins++;
        if (priceT60 > entryPrice) t60Wins++;

        const returnPct = ((currentPrice - entryPrice) / entryPrice) * 100;
        totalReturn += returnPct;

        // Push to showcase candidates
        allStocksShowcase.push({
          symbol: entry.symbol,
          companyName: entry.symbol, // We don't have companyName in roster entry, frontend might need to map it or we fetch it
          strategyId: strategyId,
          entryDate: entry.firstEntryDate,
          entryPrice: entryPrice,
          currentPrice: currentPrice,
          returnPct: Number(returnPct.toFixed(2)),
          status: returnPct > 0 ? "WINNER" : "LOSER",
          keyRationaleZh: `入选价 $${entryPrice.toFixed(2)}，至今涨幅 ${returnPct.toFixed(1)}%`,
          keyRationaleEn: `Entry $${entryPrice.toFixed(2)}, Return ${returnPct.toFixed(1)}%`,
        });
      }

      const count = entries.length;
      const t5Rate = (t5Wins / count) * 100;
      const t20Rate = (t20Wins / count) * 100;
      const t60Rate = (t60Wins / count) * 100;
      const avgRet = totalReturn / count;

      let status: "OPTIMAL" | "WARNING" | "CRITICAL" = "OPTIMAL";
      if (t5Rate < 50) status = "WARNING";
      if (t5Rate < 40) status = "CRITICAL";

      winRates.push({
        id: strategyId,
        name: preset.name,
        nameZh: preset.nameZh,
        t5WinRate: Number(t5Rate.toFixed(1)),
        t20WinRate: Number(t20Rate.toFixed(1)),
        t60WinRate: Number(t60Rate.toFixed(1)),
        avgReturn: Number(avgRet.toFixed(2)),
        status,
        totalRecommendations: count,
        iconName: preset.icon,
      });
    }

    // Populate companyNames for showcase from the stock pool
    for (const item of allStocksShowcase) {
      const stock = pool.stocks.find(s => s.symbol === item.symbol);
      if (stock) {
        item.companyName = stock.companyName;
      }
    }

    // Sort showcase by returnPct
    allStocksShowcase.sort((a, b) => b.returnPct - a.returnPct);
    
    // Pick top 3 winners and bottom 3 losers
    const winners = allStocksShowcase.filter(s => s.returnPct > 0).slice(0, 3);
    const losers = allStocksShowcase.filter(s => s.returnPct <= 0).reverse().slice(0, 3);
    const showcase = [...winners, ...losers];

    // Read self-healing logs (currently migrating the old mock data)
    const selfHealingLogs = getSelfHealingLogs();

    const auditData: Omit<AuditMetricsData, "updatedAt"> = {
      winRates,
      showcase,
      selfHealingLogs,
    };

    await saveAuditMetrics(auditData);

    return NextResponse.json({
      success: true,
      message: "Audit metrics calculated successfully",
      data: auditData
    });
  } catch (err: any) {
    console.error("[Cron: calculate-metrics] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
