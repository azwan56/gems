// ============================================================
// Analysis engine: generates structured investment reports
// Decoupled from UI — can be backed by AI API in production
// ============================================================

import { StockMetrics } from "./types";
import { calculateFundamentalScore, calculateTechnicalScore } from "./scoring-engine";

/** Analyst consensus breakdown */
export interface AnalystConsensus {
  consensus: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  targetPrice: string;
  upside: string;
  breakdown: { buy: number; hold: number; sell: number };
}

/** Full analysis report for a single stock */
export interface StockAnalysisReport {
  symbol: string;
  overview: string;
  fundamentals: string;
  products: string;
  rationale: string[];
  risks: string[];
  catalysts: string[];
  positionSuggestion: string;
  analyst: AnalystConsensus;
  technicalScore: number;
  fundamentalScore: number;
}

/** Portfolio role assigned during the final funnel step */
export type PortfolioRole =
  | "anchor"      // Large-cap growth: stability
  | "striker"     // Large-cap growth: core growth engine
  | "rocket"      // Large-cap growth: high-beta upside
  | "core_dividend"     // Value: dividend aristocrat
  | "turnaround"        // Value: cyclical reversion play
  | "special_situation"  // Value: event-driven
  | "equal_weight";     // Small-cap: VC-style equal allocation

function formatMarketCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function formatNum(val: number | null, suffix = ""): string {
  return val === null || val === undefined ? "N/A" : `${val.toFixed(1)}${suffix}`;
}

// Deterministic seed from symbol for consistent "random" data
function seedFromSymbol(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

/**
 * Generate a comprehensive analysis report for a stock.
 * In MVP mode this uses deterministic mock generation.
 * In production, replace the body with a Gemini / OpenAI API call.
 */
export function generateAnalysis(
  stock: StockMetrics,
  strategyType: "value" | "large_growth" | "small_growth"
): StockAnalysisReport {
  const seed = seedFromSymbol(stock.symbol);
  const upside = ((seed % 200) / 10 + 5).toFixed(1); // 5.0 – 25.0
  const targetPrice = (stock.price * (1 + Number(upside) / 100)).toFixed(2);

  const buyCount = 15 + (seed % 15);   // 15-29
  const holdCount = 2 + (seed % 6);    // 2-7
  const sellCount = seed % 3;          // 0-2

  const isTech = stock.sector === "Technology";

  // Strategy-specific content generation
  const overviewMap: Record<string, string> = {
    value: `${stock.companyName} (${stock.sector} / ${stock.industry}) trades at a significant discount to intrinsic value with a P/E of ${formatNum(stock.peRatio, "x")} and P/B of ${formatNum(stock.pbRatio, "x")}. The company generates substantial free cash flow (FCF Yield: ${formatNum(stock.freeCashFlowYield, "%")}), providing a strong margin of safety for value-oriented investors.`,
    large_growth: `${stock.companyName} is a dominant force in the ${stock.industry} space with a market capitalization of ${formatMarketCap(stock.marketCap)}. The company continues to deliver exceptional top-line growth (${formatNum(stock.revenueGrowthYoY, "%")} YoY) while maintaining robust profitability, positioning it as a core holding for growth-focused portfolios.`,
    small_growth: `${stock.companyName} operates in the fast-evolving ${stock.industry} segment with a market cap of ${formatMarketCap(stock.marketCap)}. Revenue is expanding at ${formatNum(stock.revenueGrowthYoY, "%")} YoY, indicating rapid market penetration. The company is in a high-growth phase typical of disruptive innovators.`,
  };

  const fundamentalsMap: Record<string, string> = {
    value: `Currently trading at $${stock.price.toFixed(2)}. Dividend yield stands at ${formatNum(stock.dividendYield, "%")} with a debt-to-equity ratio of ${formatNum(stock.debtToEquity, "x")}. Current ratio of ${formatNum(stock.currentRatio, "x")} indicates adequate liquidity. Gross margin at ${formatNum(stock.grossMargin, "%")} supports sustainable earnings power.`,
    large_growth: `Share price: $${stock.price.toFixed(2)}. Operating leverage is evident as EPS growth (${formatNum(stock.epsGrowthYoY, "%")}) outpaces revenue growth. ROE of ${formatNum(stock.roe, "%")} reflects excellent capital allocation. PEG ratio of ${formatNum(stock.pegRatio, "x")} suggests growth is reasonably priced relative to earnings trajectory.`,
    small_growth: `Share price: $${stock.price.toFixed(2)}. Gross margin of ${formatNum(stock.grossMargin, "%")} confirms a high-IP business model. Current ratio at ${formatNum(stock.currentRatio, "x")} provides cash runway for continued expansion. The company is prioritizing revenue growth over near-term profitability.`,
  };

  const productsMap: Record<string, string> = {
    value: isTech
      ? "Core offerings include mature enterprise software suites, legacy infrastructure services, and mission-critical hardware. The company's product portfolio benefits from deep customer lock-in and multi-year contract structures."
      : "The company maintains a diversified portfolio spanning consumer goods, B2B services, and industrial operations. Revenue streams are geographically balanced across North America, Europe, and emerging markets.",
    large_growth: isTech
      ? "Core offerings include proprietary cloud infrastructure, AI/ML platforms, and next-generation developer tooling. The firm is heavily investing in generative AI capabilities and automated enterprise workflows to drive ARPU expansion."
      : "The company's platform ecosystem spans digital advertising, enterprise SaaS, and consumer subscriptions. Network effects create a powerful competitive moat with high switching costs.",
    small_growth: isTech
      ? "Products focus on cutting-edge SaaS solutions in a high-growth vertical. The platform leverages AI-native architecture to deliver category-defining capabilities that larger incumbents are struggling to replicate."
      : "The company addresses a significant unmet need in its target market through innovative technology-driven solutions. Early customer adoption metrics indicate strong product-market fit.",
  };

  const rationaleMap: Record<string, string[]> = {
    value: [
      `Deep discount: Trading at ${formatNum(stock.peRatio, "x")} P/E, well below sector median, with FCF yield of ${formatNum(stock.freeCashFlowYield, "%")} acting as a cash flow floor.`,
      "Management is actively returning capital via dividends and share buybacks, signaling confidence in intrinsic value.",
      "Balance sheet resilience provides downside protection through economic cycles.",
    ],
    large_growth: [
      `Exceptional growth at scale: ${formatNum(stock.revenueGrowthYoY, "%")} revenue growth on a ${formatMarketCap(stock.marketCap)} market cap base demonstrates dominant TAM capture.`,
      "High switching costs and ecosystem lock-in create a durable competitive moat with pricing power.",
      "Margin expansion trajectory suggests operating leverage has significant room to expand.",
    ],
    small_growth: [
      `Hyper-growth trajectory: ${formatNum(stock.revenueGrowthYoY, "%")} revenue growth signals rapid market penetration in a nascent category.`,
      "First-mover advantage in a high-TAM vertical with limited direct competition from incumbents.",
      "Product-led growth model enables efficient customer acquisition and organic expansion.",
    ],
  };

  const risksMap: Record<string, string[]> = {
    value: [
      "Value trap risk: Cheapness may reflect structural decline rather than temporary mispricing.",
      "Dividend sustainability depends on continued free cash flow generation in a slowing macro environment.",
      "Limited upside catalyst visibility may result in extended periods of dead money.",
    ],
    large_growth: [
      "Regulatory scrutiny: Potential antitrust actions or data privacy regulations in key markets.",
      "Valuation compression: A sustained high-interest rate environment could compress growth multiples.",
      "Execution risk on large capex commitments (AI infrastructure, data centers) with uncertain ROI timelines.",
    ],
    small_growth: [
      "Cash burn risk: Pre-profit companies are vulnerable to capital markets freezing in risk-off environments.",
      "Customer concentration: Top-heavy revenue distribution creates single-point-of-failure risk.",
      "Competitive moat is unproven: Larger incumbents may replicate key features and leverage distribution advantages.",
    ],
  };

  const positionSuggestionMap: Record<string, string> = {
    value: "Consider building a full position (5-8%) on weakness. Maintain a medium-to-long term holding horizon to allow for mean reversion.",
    large_growth: "Core portfolio holding. Target 8-12% weight. Accumulate via dollar-cost averaging on broader market pullbacks.",
    small_growth: "Speculative position. Cap weight at 2-4%. Implement trailing stop losses to manage downside volatility.",
  };

  const catalystsMap: Record<string, string[]> = {
    value: [
      "Potential dividend hike or special dividend announcement in the upcoming quarter.",
      "Activist investor involvement pushing for spin-offs or asset sales.",
    ],
    large_growth: [
      "Integration of new AI-driven product suites driving ARPU expansion.",
      "Margin expansion following recent headcount optimizations.",
    ],
    small_growth: [
      "Securing a major tier-1 enterprise contract in the next 3-6 months.",
      "Reaching cash-flow breakeven ahead of street estimates.",
    ],
  };

  const consensusOptions: AnalystConsensus["consensus"][] = ["Strong Buy", "Buy", "Hold"];

  return {
    symbol: stock.symbol,
    overview: overviewMap[strategyType] ?? overviewMap.large_growth,
    fundamentals: fundamentalsMap[strategyType] ?? fundamentalsMap.large_growth,
    products: productsMap[strategyType] ?? productsMap.large_growth,
    rationale: rationaleMap[strategyType] ?? rationaleMap.large_growth,
    risks: risksMap[strategyType] ?? risksMap.large_growth,
    catalysts: catalystsMap[strategyType] ?? catalystsMap.large_growth,
    positionSuggestion: positionSuggestionMap[strategyType] ?? positionSuggestionMap.large_growth,
    technicalScore: calculateTechnicalScore(stock),
    fundamentalScore: calculateFundamentalScore(stock),
    analyst: {
      consensus: consensusOptions[seed % consensusOptions.length],
      targetPrice: `$${targetPrice}`,
      upside: `+${upside}%`,
      breakdown: { buy: buyCount, hold: holdCount, sell: sellCount },
    },
  };
}

/**
 * Batch-generate reports for a list of stocks.
 */
export function generateAnalysisBatch(
  stocks: StockMetrics[],
  strategyType: "value" | "large_growth" | "small_growth"
): StockAnalysisReport[] {
  return stocks.map((s) => generateAnalysis(s, strategyType));
}
