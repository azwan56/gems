import { GoogleGenAI, Type } from "@google/genai";
import type { StockMetrics } from "./types";
import type { StockAnalysisReport } from "./analysis-engine";
import { getCached, setCache } from "./fmp-cache";
import { calculateFundamentalScore, calculateTechnicalScore } from "./scoring-engine";

export async function generateGeminiAnalysis(
  stock: StockMetrics,
  strategyType: "value" | "large_growth" | "small_growth" | "multi_strategy",
  language: "en" | "zh" = "en"
): Promise<StockAnalysisReport> {
  const cacheKey = `gemini:${stock.symbol.toUpperCase()}:${strategyType}:${language}`;
  const cached = getCached<StockAnalysisReport>(cacheKey);
  if (cached) {
    console.log(`[gemini] Serving cached report for ${stock.symbol} (${strategyType}, ${language})`);
    return cached;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Try to fetch deep insights from the Python backend
  let deepInsightsStr = "";
  try {
    const pythonBackendUrl = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || "https://api.vanpower.live";
    const res = await fetch(`${pythonBackendUrl}/api/deep-insights?symbol=${stock.symbol}`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      if (data.insights && Object.keys(data.insights).length > 0) {
        deepInsightsStr = `
Deep Fundamental Insights (FMP Data):
- Institutional Ownership: ${data.insights.institutional ? `Total Invested $${(data.insights.institutional.totalInvested / 1e9).toFixed(2)}B by ${data.insights.institutional.investorsHolding} investors` : 'N/A'}
- Recent Insider Trading: ${data.insights.insider_trading ? data.insights.insider_trading.map((t: any) => `${t.transactionType} of ${t.securitiesTransacted} shares @ $${t.price} by ${t.reportingName}`).join('; ') : 'N/A'}
- Analyst Consensus: ${data.insights.analyst_ratings ? `${data.insights.analyst_ratings.consensus} (Strong Buy: ${data.insights.analyst_ratings.strongBuy}, Buy: ${data.insights.analyst_ratings.buy}, Hold: ${data.insights.analyst_ratings.hold}, Sell: ${data.insights.analyst_ratings.sell})` : 'N/A'}
- Analyst Price Target: ${data.insights.price_target ? `Consensus $${data.insights.price_target.targetConsensus} (High: $${data.insights.price_target.targetHigh}, Low: $${data.insights.price_target.targetLow})` : 'N/A'}
`;
      }
    }
  } catch (error) {
    console.warn(`[gemini] Failed to fetch deep insights for ${stock.symbol}`, error);
  }

  let strategyContext = "";
  if (strategyType === "multi_strategy") {
    strategyContext = "This stock is a highly-coveted 'Multi-Strategy Matrix' pick, meaning it simultaneously passes multiple stringent quantitative screening criteria (such as GARP, Wide Moat, Short-Term Momentum, etc.). You must highlight this multi-dimensional strength.";
  } else {
    strategyContext = `based on a ${strategyType} investment strategy.`;
  }

  const prompt = `
You are a top-tier Wall Street quantitative and qualitative equity analyst. 
You are tasked with writing a deep-dive investment memo for ${stock.companyName} (${stock.symbol}).
${strategyContext}

Metrics Data:
- Sector: ${stock.sector}
- Industry: ${stock.industry}
- Market Cap: $${(stock.marketCap / 1e9).toFixed(2)}B
- Price: $${stock.price}
- P/E Ratio: ${stock.peRatio !== null ? stock.peRatio : "N/A"}
- P/B Ratio: ${stock.pbRatio !== null ? stock.pbRatio : "N/A"}
- FCF Yield: ${stock.freeCashFlowYield !== null ? stock.freeCashFlowYield + "%" : "N/A"}
- Dividend Yield: ${stock.dividendYield !== null ? stock.dividendYield + "%" : "N/A"}
- YoY Revenue Growth: ${stock.revenueGrowthYoY !== null ? stock.revenueGrowthYoY + "%" : "N/A"}
- YoY EPS Growth: ${stock.epsGrowthYoY !== null ? stock.epsGrowthYoY + "%" : "N/A"}
- ROE: ${stock.roe !== null ? stock.roe + "%" : "N/A"}
- Gross Margin: ${stock.grossMargin !== null ? stock.grossMargin + "%" : "N/A"}
- Net Margin: ${stock.netMargin !== null ? stock.netMargin + "%" : "N/A"}
- Price vs 50SMA: ${stock.priceVs50SMA !== null ? stock.priceVs50SMA + "%" : "N/A"}
${deepInsightsStr}

Please provide a structured report. Make it sound extremely professional, insightful, and specific to the company's real-world business model and recent macroeconomic environment.
Do not use generic fluff. Use the provided metrics to ground your analysis.

IMPORTANT LANGUAGE INSTRUCTION:
Please generate the entire report (including all text fields like overview, fundamentals, products, rationale, risks) in ${language === "zh" ? "Simplified Chinese (简体中文)" : "English"}.

Rules for fields:
- overview: A strong paragraph (3-4 sentences) summarizing the company's moat, TAM, and why it fits the given strategy (or why it's a multi-strategy winner). Incorporate the deep insights (institutional/insider/analyst) if available and relevant.
- fundamentals: A paragraph analyzing their margins, growth rates, and capital efficiency based on the provided metrics.
- products: A paragraph explaining their core revenue drivers and product/service ecosystem.
- rationale: Array of 3 specific reasons to buy or hold this stock right now.
- risks: Array of 3 specific risks (macro, competitive, or execution).
- catalysts: Array of 1 to 3 specific upcoming catalysts or events that could trigger a re-rating in the next 3-6 months.
- positionSuggestion: A short paragraph (1-2 sentences) giving specific sizing or holding horizon advice (持仓建议).
- analyst.consensus: Must be exactly one of: "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell".
- analyst.targetPrice: Estimate a realistic 12-month target price formatted as "$X.XX".
- analyst.upside: Calculate the percentage upside to your target price formatted as "+X.X%" or "-X.X%".
- analyst.breakdown: A realistic distribution of analyst ratings matching the consensus.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING },
          overview: { type: Type.STRING },
          fundamentals: { type: Type.STRING },
          products: { type: Type.STRING },
          rationale: { type: Type.ARRAY, items: { type: Type.STRING } },
          risks: { type: Type.ARRAY, items: { type: Type.STRING } },
          catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
          positionSuggestion: { type: Type.STRING },
          analyst: {
            type: Type.OBJECT,
            properties: {
              consensus: { type: Type.STRING },
              targetPrice: { type: Type.STRING },
              upside: { type: Type.STRING },
              breakdown: {
                type: Type.OBJECT,
                properties: {
                  buy: { type: Type.INTEGER },
                  hold: { type: Type.INTEGER },
                  sell: { type: Type.INTEGER },
                },
                required: ["buy", "hold", "sell"],
              },
            },
            required: ["consensus", "targetPrice", "upside", "breakdown"],
          },
        },
        required: [
          "symbol",
          "overview",
          "fundamentals",
          "products",
          "rationale",
          "risks",
          "catalysts",
          "positionSuggestion",
          "analyst",
        ],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  
  const parsed = JSON.parse(text) as StockAnalysisReport;
  
  // Guarantee symbol matches what we requested, regardless of hallucination
  parsed.symbol = stock.symbol;

  // Mix in deterministic quantitative scores
  parsed.technicalScore = calculateTechnicalScore(stock);
  parsed.fundamentalScore = calculateFundamentalScore(stock);

  setCache(cacheKey, parsed);
  
  return parsed;
}
