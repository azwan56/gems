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
      { field: "peRatio", operator: "lt", value: 15 },
      { field: "pbRatio", operator: "gt", value: 0 },
      { field: "pbRatio", operator: "lt", value: 1.5 },
      { field: "freeCashFlowYield", operator: "gt", value: 5 },
      { field: "currentRatio", operator: "gt", value: 1.2 },
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
      { field: "revenueGrowthYoY", operator: "gt", value: 15 },
      { field: "epsGrowthYoY", operator: "gt", value: 15 },
      { field: "freeCashFlowYield", operator: "gt", value: 3 }, // Cash flow positive
      { field: "roe", operator: "gt", value: 20 },
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
    icon: "Rocket", // We will need to import Rocket in page.tsx
    color: "purple",
    defaultFilters: [
      { field: "marketCap", operator: "lt", value: 10_000_000_000 }, // < $10B
      { field: "marketCap", operator: "gt", value: 300_000_000 }, // > $300M (exclude micro-caps)
      { field: "revenueGrowthYoY", operator: "gt", value: 30 }, // Explosive growth
      { field: "priceVs50SMA", operator: "gt", value: 0 }, // Positive momentum
    ],
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
