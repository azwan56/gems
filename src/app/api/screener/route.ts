// ============================================================
// POST /api/screener — Execute a stock screening query
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { ScreenerRequest } from "@/lib/types";
import { getStrategyPreset } from "@/lib/strategies";
import { executeScreener } from "@/lib/screener-engine";
import { generateMockStocks } from "@/lib/mock-data";

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

    // Always use our rich mock data pool for the screener phase.
    // Fetching 50+ live FMP profiles sequentially (due to free tier limits) 
    // takes too long and exhausts the 250/day quota instantly.
    // We reserve the live FMP API calls + Gemini AI purely for the "Read Report" deep-dive phase.
    const stocks = generateMockStocks();

    const screenerRequest: ScreenerRequest = {
      ...body,
      filters,
    };

    const result = executeScreener(stocks, screenerRequest);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "SCREENER_ERROR", message },
      { status: 500 }
    );
  }
}
