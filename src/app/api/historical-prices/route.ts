import { NextRequest, NextResponse } from "next/server";
import { fmpFetch, parallelBatchFetch } from "@/lib/fmp-fetch";
import { hasApiKey } from "@/lib/fmp-config";
import { requirePremium } from "@/lib/auth-middleware";

export interface HistoricalPricesRequest {
  queries: { symbol: string; date: string }[];
}

export async function POST(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  if (!hasApiKey()) {
    return NextResponse.json(
      { error: "FMP_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const { queries }: HistoricalPricesRequest = await request.json();
    if (!queries || !Array.isArray(queries)) {
      return NextResponse.json({ error: "Invalid request format. Expected { queries: { symbol, date }[] }" }, { status: 400 });
    }

    const results: Record<string, Record<string, number>> = {};
    
    // Group queries by symbol to minimize redundant FMP calls
    const symbolMap = new Map<string, Set<string>>();
    for (const q of queries) {
      if (!symbolMap.has(q.symbol)) symbolMap.set(q.symbol, new Set());
      symbolMap.get(q.symbol)!.add(q.date);
    }

    const { map: fetchMap } = await parallelBatchFetch(
      Array.from(symbolMap.keys()),
      async (symbol) => {
        const datesSet = symbolMap.get(symbol)!;
        const dates = Array.from(datesSet);
        if (dates.length === 0) return null;
        
        // Find min and max dates to fetch an optimal range
        dates.sort();
        const fromDate = dates[0];
        
        // Add a 5-day padding to fromDate in case fromDate is a weekend/holiday
        // so we can fetch preceding trading days
        const fromDateObj = new Date(fromDate);
        fromDateObj.setDate(fromDateObj.getDate() - 5);
        const paddedFromDate = fromDateObj.toISOString().split('T')[0];

        const toDate = dates[dates.length - 1];

        // Fetch from FMP: /historical-price-eod/full?symbol={symbol}&from={paddedFromDate}&to={toDate}
        // Cache heavily for 24 hours (86400s) because historical prices don't change
        const data = await fmpFetch<Array<{ date: string; close: number; adjClose?: number }>>(
          `/historical-price-eod/full`, 
          { symbol, from: paddedFromDate, to: toDate }, 
          { revalidate: 86400 }
        );
        
        const symbolResults: Record<string, number> = {};
        interface HistItem { date: string; close: number; adjClose?: number }
        const historicalArray: HistItem[] = Array.isArray(data) ? data : ((data as any)?.historical || []);
        
        if (historicalArray.length > 0) {
          for (const date of dates) {
            // Find exact match first
            const exactMatch = historicalArray.find((h: HistItem) => h.date === date);
            if (exactMatch) {
              symbolResults[date] = exactMatch.adjClose ?? exactMatch.close;
            } else {
              // If exact date not found (e.g., weekend or holiday), find closest preceding trading day
              const preceding = historicalArray
                .filter((h: HistItem) => h.date <= date)
                .sort((a: HistItem, b: HistItem) => b.date.localeCompare(a.date)); // Descending order
                
              if (preceding.length > 0) {
                 symbolResults[date] = preceding[0].adjClose ?? preceding[0].close;
              }
            }
          }
        }
        
        return { key: symbol, value: symbolResults };
      },
      { batchSize: 5, delayMs: 1000 }
    );

    // Convert map back to results object
    for (const [symbol, symbolData] of Array.from(fetchMap.entries())) {
      results[symbol] = symbolData;
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("[historical-prices] API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
