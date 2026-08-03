// ============================================================
// Strategy Preset Store — fetches from Firestore
// ============================================================

import { getDb } from "./firebase";
import { StrategyPreset } from "./types";

const COLLECTION = "strategy_presets";

let cache: Record<string, StrategyPreset> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export const DEFAULT_STRATEGY_PRESETS: Record<string, StrategyPreset> = {
  value: {
    id: "value",
    name: "Value Investing",
    nameZh: "价值投资",
    description: "Find fundamentally strong companies trading below intrinsic value. Emphasizes margin of safety, high free cash flow, and healthy balance sheets.",
    descriptionZh: "寻找基本面健康但被市场低估的公司。强调安全边际、高自由现金流和健康的资产负债表。",
    icon: "ShieldCheck",
    color: "blue",
    defaultFilters: [
      { field: "peRatio", operator: "gt", value: 0 },
      { field: "peRatio", operator: "lt", value: 20 },
      { field: "pbRatio", operator: "gt", value: 0 },
      { field: "pbRatio", operator: "lt", value: 3.0 },
      { field: "freeCashFlowYield", operator: "gt", value: 3 },
      { field: "currentRatio", operator: "gt", value: 1.0 },
      { field: "marketCap", operator: "gt", value: 1_000_000_000 },
    ],
  },
  large_growth: {
    id: "large_growth",
    name: "Large-Cap Growth",
    nameZh: "大型成长股",
    description: "Nasdaq-100 level titans. Driven by industry monopoly, global expansion, and structural shifts. Features robust free cash flow and strong resilience.",
    descriptionZh: "Nasdaq-100 级别的科技巨头与超级平台。行业垄断力强，自由现金流充沛，抗风险能力极高。",
    icon: "TrendingUp",
    color: "indigo",
    defaultFilters: [
      { field: "marketCap", operator: "gt", value: 100_000_000_000 },
      { field: "revenueGrowthYoY", operator: "gt", value: 10 },
      { field: "epsGrowthYoY", operator: "gt", value: 10 },
      { field: "freeCashFlowYield", operator: "gt", value: 1.5 },
      { field: "grossMargin", operator: "gt", value: 40 },
    ],
  },
  small_growth: {
    id: "small_growth",
    name: "Small/Mid-Cap Growth",
    nameZh: "中小盘成长股",
    description: "Russell 2000 Growth level innovators. Driven by disruptive tech and rapid market penetration. Often unprofitable but growing revenues explosively.",
    descriptionZh: "Russell 2000 级别的新兴颠覆者。依赖技术突破与渗透率提升，爆发力强但可能尚未盈利。",
    icon: "Rocket",
    color: "purple",
    defaultFilters: [
      { field: "marketCap", operator: "lt", value: 50_000_000_000 },
      { field: "marketCap", operator: "gt", value: 300_000_000 },
      { field: "revenueGrowthYoY", operator: "gt", value: 20 },
      { field: "priceVs50SMA", operator: "gt", value: 0 },
    ],
  },
  seeking_alpha: {
    id: "seeking_alpha",
    name: "Seeking Alpha Picks",
    nameZh: "Seeking Alpha 精选",
    description: "A curated stock list imported from Seeking Alpha. Bypasses quantitative screening — all stocks are displayed with their raw metrics for direct qualitative analysis.",
    descriptionZh: "从 Seeking Alpha 导入的自选股清单。跳过定量筛选步骤，直接展示所有标的原始指标数据，作为定性深研的参考。",
    icon: "BookOpen",
    color: "amber",
    defaultFilters: [],
  },
  garp: {
    id: "garp",
    name: "GARP (Growth At a Reasonable Price)",
    nameZh: "合理价格成长",
    description: "Combines growth and value investing. Looks for companies with strong EPS growth but undervalued PEG ratios.",
    descriptionZh: "结合成长与价值投资。寻找具有强劲EPS增长但PEG估值偏低的公司。",
    icon: "TrendingUp",
    color: "emerald",
    defaultFilters: [
      { field: "epsGrowthYoY", operator: "gt", value: 30 },
      { field: "pegRatio", operator: "gt", value: 0.1 },
      { field: "pegRatio", operator: "lt", value: 0.7 },
      { field: "roe", operator: "gt", value: 25 },
      { field: "marketCap", operator: "gt", value: 2_000_000_000 },
    ],
  },
  wide_moat: {
    id: "wide_moat",
    name: "Wide Moat",
    nameZh: "深宽护城河",
    description: "Companies with enduring competitive advantages. Features high return on equity and superior gross margins.",
    descriptionZh: "具有持久竞争优势的公司。拥有极高的净资产收益率(ROE)和优异的毛利率。",
    icon: "Castle",
    color: "slate",
    defaultFilters: [
      { field: "roe", operator: "gt", value: 25 },
      { field: "grossMargin", operator: "gt", value: 60 },
      { field: "marketCap", operator: "gt", value: 5_000_000_000 },
      { field: "debtToEquity", operator: "lt", value: 0.8 },
    ],
  },
  short_term_catalyst: {
    id: "short_term_catalyst",
    name: "Short-Term Catalyst",
    nameZh: "短线催化剂",
    description: "Momentum play focusing on technical breakouts and short-term trends.",
    descriptionZh: "侧重于技术面突破和短期趋势的动量策略。",
    icon: "Zap",
    color: "rose",
    defaultFilters: [
      { field: "priceVs50SMA", operator: "gt", value: 4 },
      { field: "priceVs200SMA", operator: "gt", value: 10 },
      { field: "revenueGrowthYoY", operator: "gt", value: 20 },
      { field: "marketCap", operator: "gt", value: 3_000_000_000 },
    ],
  },
};

/**
 * Fetch all strategy presets from Firestore with fallback to DEFAULT_STRATEGY_PRESETS
 */
export async function getAllStrategyPresets(): Promise<StrategyPreset[]> {
  const now = Date.now();
  if (cache && now < cacheExpiry) {
    return Object.values(cache);
  }

  try {
    const db = getDb();
    const snapshot = await db.collection(COLLECTION).get();
    
    if (snapshot.docs.length > 0) {
      const presets: Record<string, StrategyPreset> = {};
      for (const doc of snapshot.docs) {
        presets[doc.id] = doc.data() as StrategyPreset;
      }
      // Merge defaults in case any presets are missing from Firestore
      cache = { ...DEFAULT_STRATEGY_PRESETS, ...presets };
    } else {
      // Auto-seed Firestore if empty
      cache = { ...DEFAULT_STRATEGY_PRESETS };
      const batch = db.batch();
      for (const [id, preset] of Object.entries(DEFAULT_STRATEGY_PRESETS)) {
        batch.set(db.collection(COLLECTION).doc(id), preset);
      }
      batch.commit().catch(e => console.error("[StrategyPresetStore] Auto-seed failed:", e));
    }
  } catch (e) {
    console.error("[StrategyPresetStore] Firestore fetch failed, using defaults:", e);
    cache = { ...DEFAULT_STRATEGY_PRESETS };
  }
  
  cacheExpiry = now + CACHE_TTL;
  return Object.values(cache);
}

/**
 * Fetch a specific strategy preset by ID
 */
export async function getStrategyPreset(strategyId: string): Promise<StrategyPreset | undefined> {
  const now = Date.now();
  if (cache && now < cacheExpiry) {
    return cache[strategyId] || DEFAULT_STRATEGY_PRESETS[strategyId];
  }

  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(strategyId).get();
    if (doc.exists) {
      return doc.data() as StrategyPreset;
    }
  } catch (e) {
    console.error(`[StrategyPresetStore] Failed to get strategy ${strategyId}:`, e);
  }
  
  return DEFAULT_STRATEGY_PRESETS[strategyId];
}

/**
 * Update a strategy preset's defaultFilters
 */
export async function updateStrategyFilters(strategyId: string, newFilters: any[]): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(strategyId).update({
    defaultFilters: newFilters
  });
  
  // Invalidate cache
  cache = null;
  cacheExpiry = 0;
}
