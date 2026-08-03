// ============================================================
// Strategy Preset Store — fetches from Firestore
// ============================================================

import { getDb } from "./firebase";
import { StrategyPreset } from "./types";
import { DEFAULT_STRATEGY_PRESETS } from "./strategy-constants";

const COLLECTION = "strategy_presets";

let cache: Record<string, StrategyPreset> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

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
