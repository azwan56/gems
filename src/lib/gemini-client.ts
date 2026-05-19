import { GoogleGenAI, Type } from "@google/genai";
import type { StockMetrics } from "./types";
import type { StockAnalysisReport } from "./analysis-engine";

export async function generateGeminiAnalysis(
  stock: StockMetrics,
  strategyType: "value" | "large_growth" | "small_growth",
  language: "en" | "zh" = "en"
): Promise<StockAnalysisReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are a top-tier Wall Street quantitative and qualitative equity analyst. 
You are tasked with writing a deep-dive investment memo for ${stock.companyName} (${stock.symbol}) based on the following real-time metrics and a ${strategyType} investment strategy.

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

Please provide a structured report. Make it sound extremely professional, insightful, and specific to the company's real-world business model and recent macroeconomic environment.
Do not use generic fluff. Use the provided metrics to ground your analysis.

IMPORTANT LANGUAGE INSTRUCTION:
Please generate the entire report (including all text fields like overview, fundamentals, products, rationale, risks) in ${language === "zh" ? "Simplified Chinese (简体中文)" : "English"}.

Rules for fields:
- overview: A strong paragraph (3-4 sentences) summarizing the company's moat, TAM, and why it fits the ${strategyType} strategy.
- fundamentals: A paragraph analyzing their margins, growth rates, and capital efficiency based on the provided metrics.
- products: A paragraph explaining their core revenue drivers and product/service ecosystem.
- rationale: Array of 3 specific reasons to buy or hold this stock right now.
- risks: Array of 3 specific risks (macro, competitive, or execution).
- positionSuggestion: A short paragraph (1-2 sentences) giving specific sizing or holding horizon advice (持仓建议).
- analyst.consensus: Must be exactly one of: "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell".
- analyst.targetPrice: Estimate a realistic 12-month target price formatted as "$X.XX".
- analyst.upside: Calculate the percentage upside to your target price formatted as "+X.X%" or "-X.X%".
- analyst.breakdown: A realistic distribution of analyst ratings matching the consensus.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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
  
  return parsed;
}
