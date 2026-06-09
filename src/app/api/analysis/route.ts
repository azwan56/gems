// ============================================================
// GET  /api/analysis?symbol=AAPL&strategy=large_growth&lang=zh
// POST /api/analysis — Batch generate reports
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis, generateAnalysisBatch } from "@/lib/analysis-engine";
import { generateGeminiAnalysis } from "@/lib/gemini-client";
import { resolveStock } from "@/lib/stock-resolver";
import type { StockMetrics } from "@/lib/types";
import { requirePremium } from "@/lib/auth-middleware";

const VALID_STRATEGIES = ["value", "large_growth", "small_growth"] as const;
const ACCEPTED_STRATEGIES = ["value", "large_growth", "small_growth", "seeking_alpha", "garp", "wide_moat", "short_term_catalyst"] as const;
type Strategy = (typeof VALID_STRATEGIES)[number];
type Lang = "en" | "zh";

function isAcceptedStrategy(s: string): boolean {
  return (ACCEPTED_STRATEGIES as readonly string[]).includes(s);
}

/**
 * Map incoming strategy to an analysis-compatible strategy.
 * seeking_alpha / garp → large_growth (growth-style analysis)
 * wide_moat → value (value-style analysis)
 * short_term_catalyst → small_growth (momentum-style analysis)
 */
function toAnalysisStrategy(s: string): Strategy {
  if (s === "seeking_alpha" || s === "garp") return "large_growth";
  if (s === "wide_moat") return "value";
  if (s === "short_term_catalyst") return "small_growth";
  return s as Strategy;
}

export async function GET(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  const symbol = request.nextUrl.searchParams.get("symbol");
  const rawStrategy = request.nextUrl.searchParams.get("strategy") ?? "large_growth";
  const lang: Lang = request.nextUrl.searchParams.get("lang") === "zh" ? "zh" : "en";

  if (!symbol) {
    return NextResponse.json(
      { error: "MISSING_SYMBOL", message: "symbol query parameter is required" },
      { status: 400 }
    );
  }

  if (!isAcceptedStrategy(rawStrategy)) {
    return NextResponse.json(
      { error: "INVALID_STRATEGY", message: `strategy must be one of: ${ACCEPTED_STRATEGIES.join(", ")}` },
      { status: 400 }
    );
  }

  const strategy = toAnalysisStrategy(rawStrategy);

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
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

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

    const strat: Strategy = strategy && isAcceptedStrategy(strategy) ? toAnalysisStrategy(strategy) : "large_growth";
    const lang: Lang = bodyLang === "zh" ? "zh" : "en";

    const resolved: StockMetrics[] = [];
    const notFound: string[] = [];

    // Resolve all symbols in parallel (was sequential before)
    const settled = await Promise.allSettled(
      symbols.map((sym: string) => resolveStock(sym))
    );
    for (let i = 0; i < symbols.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled" && result.value) {
        resolved.push(result.value);
      } else {
        notFound.push(symbols[i]);
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
