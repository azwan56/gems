import { NextRequest, NextResponse } from "next/server";
import { loadAuditMetrics, saveAuditMetrics } from "@/lib/audit-metrics-store";
import { getStrategyPreset, updateStrategyFilters } from "@/lib/strategy-preset-store";
import { GoogleGenAI, Type } from "@google/genai";
import { SelfHealingLog } from "@/lib/audit-store";
import crypto from "crypto";

export const maxDuration = 300; // 5 mins

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const metrics = await loadAuditMetrics();
    if (!metrics) {
      return NextResponse.json({ error: "No audit metrics available" }, { status: 500 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not defined" }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey });

    const newLogs: SelfHealingLog[] = [];
    let updatedAny = false;

    for (const winRate of metrics.winRates) {
      if (winRate.id === "seeking_alpha") continue;
      
      // Trigger self-healing if win rate drops below 50% and there is sufficient sample size
      if (winRate.t5WinRate < 50 && winRate.totalRecommendations > 0) {
        const preset = await getStrategyPreset(winRate.id);
        if (!preset) continue;

        console.log(`[AI Self-Healing] Initiating self-healing for ${winRate.id} (T+5 Win Rate: ${winRate.t5WinRate}%)`);

        const systemInstruction = `You are an elite quantitative trading AI specializing in strategy self-healing.
A trading strategy has underperformed, with its T+5 win rate dropping to ${winRate.t5WinRate}%.
Your task is to adjust its quantitative filters to make them more strict or better adapted to the current macroeconomic climate.
Output a JSON response containing the updated filters array and a log of the action taken.

IMPORTANT: The filters must follow the exact same schema. Do NOT use markdown. Return ONLY valid JSON.
Valid metrics are: marketCap, peRatio, pbRatio, freeCashFlowYield, dividendYield, revenueGrowthYoY, epsGrowthYoY, roe, grossMargin, netMargin, priceVs50SMA, technicalScore, fundamentalScore.
Valid operators are: '>', '<', '>=', '<=', '=='.`;

        const userPrompt = `Strategy: ${preset.name} (${preset.nameZh})
Description: ${preset.description}
Current Filters: ${JSON.stringify(preset.defaultFilters, null, 2)}

Provide the updated filters that will improve the win rate.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                newFilters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      metric: { type: Type.STRING },
                      operator: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    },
                    required: ["metric", "operator", "value"]
                  }
                },
                triggerEvent: { type: Type.STRING, description: "Short description of why it triggered in English" },
                triggerEventZh: { type: Type.STRING, description: "Short description of why it triggered in Chinese" },
                actionTaken: { type: Type.STRING, description: "What was changed in English" },
                actionTakenZh: { type: Type.STRING, description: "What was changed in Chinese" },
                impactScore: { type: Type.STRING, description: "e.g. 'High', 'Medium'" },
                impactScoreZh: { type: Type.STRING, description: "e.g. '高', '中'" }
              },
              required: ["newFilters", "triggerEvent", "triggerEventZh", "actionTaken", "actionTakenZh", "impactScore", "impactScoreZh"]
            }
          }
        });

        const text = response.text;
        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.newFilters && Array.isArray(parsed.newFilters)) {
              // Write new filters to Firestore
              await updateStrategyFilters(winRate.id, parsed.newFilters);
              
              // Append to self-healing logs
              const logEntry: SelfHealingLog = {
                id: crypto.randomUUID(),
                date: new Date().toISOString().split("T")[0],
                strategyId: winRate.id,
                strategyNameZh: preset.nameZh,
                triggerEvent: parsed.triggerEvent || `T+5 Win Rate dropped to ${winRate.t5WinRate}%`,
                triggerEventZh: parsed.triggerEventZh || `T+5 胜率下降至 ${winRate.t5WinRate}%`,
                actionTaken: parsed.actionTaken || `Adjusted filters`,
                actionTakenZh: parsed.actionTakenZh || `调整了过滤条件`,
                impactScore: parsed.impactScore || "High",
                impactScoreZh: parsed.impactScoreZh || "高"
              };
              newLogs.push(logEntry);
              updatedAny = true;
              console.log(`[AI Self-Healing] Successfully healed ${winRate.id}`);
            }
          } catch (e) {
            console.error(`[AI Self-Healing] Failed to parse Gemini response for ${winRate.id}`, e);
          }
        }
      }
    }

    if (updatedAny) {
      // Prepend new logs to the top
      metrics.selfHealingLogs = [...newLogs, ...metrics.selfHealingLogs];
      // Keep only top 50 logs to avoid unbounded growth
      if (metrics.selfHealingLogs.length > 50) {
        metrics.selfHealingLogs = metrics.selfHealingLogs.slice(0, 50);
      }
      await saveAuditMetrics(metrics);
    }

    return NextResponse.json({ 
      success: true, 
      healedStrategies: newLogs.map(l => l.strategyId),
      logs: newLogs
    });
  } catch (error) {
    console.error("[AI Self-Healing] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
