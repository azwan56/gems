import { NextRequest, NextResponse } from "next/server";
import { fmpFetch } from "@/lib/fmp-fetch";
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

    await Promise.allSettled(
      Array.from(symbolMap.entries()).map(async ([symbol, datesSet]) => {
        const dates = Array.from(datesSet);
        if (dates.length === 0) return;
        
        // Find min and max dates to fetch an optimal range
        dates.sort();
        const fromDate = dates[0];
        
        // Add a 5-day padding to fromDate in case fromDate is a weekend/holiday
        // so we can fetch preceding trading days
        const fromDateObj = new Date(fromDate);
        fromDateObj.setDate(fromDateObj.getDate() - 5);
        const paddedFromDate = fromDateObj.toISOString().split('T')[0];

        const toDate = dates[dates.length - 1];

        // Fetch from FMP: /historical-price-full/{symbol}?from={paddedFromDate}&to={toDate}
        // Cache heavily for 24 hours (86400s) because historical prices don't change
        const data = await fmpFetch<{ historical: Array<{ date: string; close: number; adjClose?: number }> }>(
          `/historical-price-full/${symbol}`, 
          { from: paddedFromDate, to: toDate }, 
          { revalidate: 86400 }
        );
        
        if (data && data.historical && Array.isArray(data.historical)) {
          if (!results[symbol]) results[symbol] = {};
          
          for (const date of dates) {
            // Find exact match first
            const exactMatch = data.historical.find(h => h.date === date);
            if (exactMatch) {
              results[symbol][date] = exactMatch.adjClose ?? exactMatch.close;
            } else {
              // If exact date not found (e.g., weekend or holiday), find closest preceding trading day
              const preceding = data.historical
                .filter(h => h.date <= date)
                .sort((a, b) => b.date.localeCompare(a.date)); // Descending order
                
              if (preceding.length > 0) {
                 results[symbol][date] = preceding[0].adjClose ?? preceding[0].close;
              }
            }
          }
        }
      })
    );

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("[historical-prices] API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
