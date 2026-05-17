// ============================================================
// GET  /api/analysis?symbol=AAPL&strategy=large_growth&lang=zh
// POST /api/analysis — Batch generate reports
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis, generateAnalysisBatch } from "@/lib/analysis-engine";
import { generateGeminiAnalysis } from "@/lib/gemini-client";
import { resolveStock } from "@/lib/stock-resolver";
import type { StockMetrics } from "@/lib/types";

const VALID_STRATEGIES = ["value", "large_growth", "small_growth"] as const;
type Strategy = (typeof VALID_STRATEGIES)[number];
type Lang = "en" | "zh";

function isValidStrategy(s: string): s is Strategy {
  return (VALID_STRATEGIES as readonly string[]).includes(s);
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const strategy = request.nextUrl.searchParams.get("strategy") ?? "large_growth";
  const lang: Lang = request.nextUrl.searchParams.get("lang") === "zh" ? "zh" : "en";

  if (!symbol) {
    return NextResponse.json(
      { error: "MISSING_SYMBOL", message: "symbol query parameter is required" },
      { status: 400 }
    );
  }

  if (!isValidStrategy(strategy)) {
    return NextResponse.json(
      { error: "INVALID_STRATEGY", message: `strategy must be one of: ${VALID_STRATEGIES.join(", ")}` },
      { status: 400 }
    );
  }

  const stock = await resolveStock(symbol);
  if (!stock) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: `Stock ${symbol} not found in current data pool` },
      { status: 404 }
    );
  }

  try {
    let report;
    if (process.env.GEMINI_API_KEY) {
      report = await generateGeminiAnalysis(stock, strategy, lang);
    } else {
      report = generateAnalysis(stock, strategy);
    }
    return NextResponse.json({ report });
  } catch (error) {
    console.error("Analysis generation failed:", error);
    return NextResponse.json(
      { error: "GENERATION_FAILED", message: "Failed to generate analysis report." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols, strategy, lang: bodyLang } = body as {
      symbols?: string[];
      strategy?: string;
      lang?: string;
    };

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: "MISSING_SYMBOLS", message: "symbols array is required" },
        { status: 400 }
      );
    }

    const strat: Strategy = strategy && isValidStrategy(strategy) ? strategy : "large_growth";
    const lang: Lang = bodyLang === "zh" ? "zh" : "en";

    const resolved: StockMetrics[] = [];
    const notFound: string[] = [];

    for (const sym of symbols) {
      const stock = await resolveStock(sym);
      if (stock) {
        resolved.push(stock);
      } else {
        notFound.push(sym);
      }
    }

    let reports;
    if (process.env.GEMINI_API_KEY) {
      reports = await Promise.all(
        resolved.map((stock) => generateGeminiAnalysis(stock, strat, lang))
      );
    } else {
      reports = generateAnalysisBatch(resolved, strat);
    }

    return NextResponse.json({
      reports,
      notFound: notFound.length > 0 ? notFound : undefined,
    });
  } catch (error) {
    console.error("Batch analysis generation failed:", error);
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid JSON body or generation error" },
      { status: 400 }
    );
  }
}
