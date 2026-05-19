// ============================================================
// Strategy presets with default quantitative filter criteria
// ============================================================

import { StrategyPreset } from "./types";

export const STRATEGY_PRESETS: Record<string, StrategyPreset> = {
  value: {
    id: "value",
    name: "Value Investing",
    nameZh: "价值投资",
    description:
      "Find fundamentally strong companies trading below intrinsic value. Emphasizes margin of safety, high free cash flow, and healthy balance sheets.",
    descriptionZh:
      "寻找基本面健康但被市场低估的公司。强调安全边际、高自由现金流和健康的资产负债表。",
    icon: "ShieldCheck",
    color: "blue",
    defaultFilters: [
      { field: "peRatio", operator: "gt", value: 0 },
      { field: "peRatio", operator: "lt", value: 20 },       // relaxed from 15 for real market valuations
      { field: "pbRatio", operator: "gt", value: 0 },
      { field: "pbRatio", operator: "lt", value: 3.0 },      // relaxed from 1.5 — few real stocks below 1.5
      { field: "freeCashFlowYield", operator: "gt", value: 3 }, // relaxed from 5%
      { field: "currentRatio", operator: "gt", value: 1.0 },   // relaxed from 1.2
      { field: "marketCap", operator: "gt", value: 1_000_000_000 }, // > $1B
    ],
  },
  large_growth: {
    id: "large_growth",
    name: "Large-Cap Growth",
    nameZh: "大型成长股",
    description:
      "Nasdaq-100 level titans. Driven by industry monopoly, global expansion, and structural shifts. Features robust free cash flow and strong resilience.",
    descriptionZh:
      "Nasdaq-100 级别的科技巨头与超级平台。行业垄断力强，自由现金流充沛，抗风险能力极高。",
    icon: "TrendingUp",
    color: "indigo",
    defaultFilters: [
      { field: "marketCap", operator: "gt", value: 100_000_000_000 }, // > $100B
      { field: "revenueGrowthYoY", operator: "gt", value: 10 },       // relaxed from 15%
      { field: "epsGrowthYoY", operator: "gt", value: 10 },           // relaxed from 15%
      { field: "freeCashFlowYield", operator: "gt", value: 1.5 },     // relaxed from 3% — growth reinvests
      { field: "grossMargin", operator: "gt", value: 40 },            // quality proxy (replaces ROE which FMP often omits)
    ],
  },
  small_growth: {
    id: "small_growth",
    name: "Small/Mid-Cap Growth",
    nameZh: "中小盘成长股",
    description:
      "Russell 2000 Growth level innovators. Driven by disruptive tech and rapid market penetration. Often unprofitable but growing revenues explosively.",
    descriptionZh:
      "Russell 2000 级别的新兴颠覆者。依赖技术突破与渗透率提升，爆发力强但可能尚未盈利。",
    icon: "Rocket",
    color: "purple",
    defaultFilters: [
      { field: "marketCap", operator: "lt", value: 50_000_000_000 },  // raised from $10B — many mid-caps now $10-50B
      { field: "marketCap", operator: "gt", value: 300_000_000 },     // > $300M (exclude micro-caps)
      { field: "revenueGrowthYoY", operator: "gt", value: 20 },      // relaxed from 30%
      { field: "priceVs50SMA", operator: "gt", value: 0 },           // Positive momentum
    ],
  },
  seeking_alpha: {
    id: "seeking_alpha",
    name: "Seeking Alpha Picks",
    nameZh: "Seeking Alpha 精选",
    description:
      "A curated stock list imported from Seeking Alpha. Bypasses quantitative screening — all stocks are displayed with their raw metrics for direct qualitative analysis.",
    descriptionZh:
      "从 Seeking Alpha 导入的自选股清单。跳过定量筛选步骤，直接展示所有标的的原始指标数据，作为定性深研的参考。",
    icon: "BookOpen",
    color: "amber",
    defaultFilters: [], // No filters — SA stocks bypass Step 1
  },
};

/** Returns the preset for a given strategy type, or undefined */
export function getStrategyPreset(
  strategyId: string
): StrategyPreset | undefined {
  return STRATEGY_PRESETS[strategyId];
}

/** Returns all available strategy presets as an array */
export function getAllStrategyPresets(): StrategyPreset[] {
  return Object.values(STRATEGY_PRESETS);
}
