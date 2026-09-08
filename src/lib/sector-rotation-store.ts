// ============================================================
// Sector Rotation Store — Server-side accessor for 3D RRG
// and Macro Cycle data from shared Firestore (dailystockrpt).
// ============================================================

import { getDb } from "./firebase";
import {
  SectorRotationData,
  StockSectorWind,
  getSectorRotationForStockSync,
} from "./sector-rotation";

export * from "./sector-rotation";

// In-memory TTL cache (15 minutes)
let cachedRotation: { data: SectorRotationData; timestamp: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Fetch the latest sector rotation matrix from Firestore.
 * Server-only function.
 */
export async function getLatestSectorRotation(): Promise<SectorRotationData | null> {
  const now = Date.now();
  if (cachedRotation && now - cachedRotation.timestamp < CACHE_TTL_MS) {
    return cachedRotation.data;
  }

  try {
    const db = getDb();
    const snapshot = await db
      .collection("sector_rotation_cache")
      .orderBy("date", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0].data();
    const macroCycle = doc.macro_cycle || {};
    const rotationMatrix = doc.rotation_matrix || {};
    const rrgSnapshot = doc.rrg_snapshot || {};
    const sectorMap = macroCycle.sector_map || {};

    const sectors: SectorRotationData["sectors"] = {};
    const matrixSectors = rotationMatrix.sectors || rrgSnapshot.sectors || {};

    for (const [sym, data] of Object.entries<any>(matrixSectors)) {
      sectors[sym] = {
        name: data.name || sym,
        quadrant: data.quadrant || "Unknown",
        action: data.action || "NEUTRAL",
        macroAlignment: data.macro_alignment || "neutral",
        netScore: data.net_score ?? 0,
        bullishScore: data.bullish_score ?? 0,
        bearishScore: data.bearish_score ?? 0,
        recommendedStocks: data.actionable_plan?.recommended_stocks || [],
        trimStocks: data.actionable_plan?.trim_stocks || [],
      };
    }

    const rotationData: SectorRotationData = {
      date: doc.date || snapshot.docs[0].id,
      macroPhase: macroCycle.phase || "Mid",
      favoredSectors: sectorMap.favored || [],
      avoidSectors: sectorMap.avoid || [],
      sectors,
      narrative: doc.rotation_narrative || "",
      tacticalActionCards: doc.tactical_action_cards || "",
    };

    cachedRotation = { data: rotationData, timestamp: now };
    return rotationData;
  } catch (err) {
    console.warn("[SectorRotationStore] Could not load sector rotation cache:", err);
    return null;
  }
}

/**
 * Async helper to get sector wind with auto-loaded Firestore rotation cache.
 * Server-only function.
 */
export async function getSectorRotationForStock(
  symbol: string,
  sectorName?: string
): Promise<StockSectorWind> {
  const rotData = await getLatestSectorRotation();
  return getSectorRotationForStockSync(symbol, sectorName, rotData);
}
