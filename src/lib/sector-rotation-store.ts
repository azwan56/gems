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
      const rrgSec = rrgSnapshot.sectors?.[sym] || {};
      sectors[sym] = {
        name: data.name || rrgSec.name || sym,
        quadrant: data.quadrant || rrgSec.quadrant || "Unknown",
        action: data.action || "NEUTRAL",
        macroAlignment: data.macro_alignment || "neutral",
        netScore: data.net_score ?? 0,
        bullishScore: data.bullish_score ?? 0,
        bearishScore: data.bearish_score ?? 0,
        recommendedStocks: data.actionable_plan?.recommended_stocks || [],
        trimStocks: data.actionable_plan?.trim_stocks || [],
        rsRatio: rrgSec.rs_ratio ?? data.rs_ratio ?? 100,
        rsMomentum: rrgSec.rs_momentum ?? data.rs_momentum ?? 100,
        velocity: rrgSec.velocity ?? data.velocity ?? 0,
        directionAngle: rrgSec.direction_angle ?? data.direction_angle ?? 0,
        trajectory: rrgSec.trajectory || data.trajectory || [],
      };
    }

    const subIndustries: NonNullable<SectorRotationData["subIndustries"]> = {};
    const matrixSub = rotationMatrix.sub_industries || rrgSnapshot.sub_industries || {};

    for (const [sym, data] of Object.entries<any>(matrixSub)) {
      const rrgSub = rrgSnapshot.sub_industries?.[sym] || {};
      subIndustries[sym] = {
        name: data.name || rrgSub.name || sym,
        parentSector: data.parent_sector || rrgSub.parent_sector || "SPY",
        quadrant: data.quadrant || rrgSub.quadrant || "Unknown",
        action: data.action || "NEUTRAL",
        macroAlignment: data.macro_alignment || "neutral",
        netScore: data.net_score ?? 0,
        bullishScore: data.bullish_score ?? 0,
        bearishScore: data.bearish_score ?? 0,
        recommendedStocks: data.actionable_plan?.recommended_stocks || [],
        trimStocks: data.actionable_plan?.trim_stocks || [],
        rsRatio: rrgSub.rs_ratio ?? data.rs_ratio ?? 100,
        rsMomentum: rrgSub.rs_momentum ?? data.rs_momentum ?? 100,
        velocity: rrgSub.velocity ?? data.velocity ?? 0,
        directionAngle: rrgSub.direction_angle ?? data.direction_angle ?? 0,
        trajectory: rrgSub.trajectory || data.trajectory || [],
      };
    }

    const rotationData: SectorRotationData = {
      date: doc.date || snapshot.docs[0].id,
      macroPhase: macroCycle.phase || "Mid",
      favoredSectors: sectorMap.favored || [],
      avoidSectors: sectorMap.avoid || [],
      sectors,
      subIndustries,
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
  sectorName?: string,
  industryName?: string
): Promise<StockSectorWind> {
  const rotData = await getLatestSectorRotation();
  return getSectorRotationForStockSync(symbol, sectorName, industryName, rotData);
}
