// ============================================================
// Stock Pool Store — persists fetched stock data in Firestore
// so we don't re-fetch from FMP on every screening request.
// All stocks stored in a single document for 1-read efficiency.
// ============================================================

import { getDb } from "./firebase";
import { StockMetrics } from "./types";

const COLLECTION = "stock_pools";
const DOC_ID = "latest";

export interface StockPoolMeta {
  updatedAt: string;
  symbolCount: number;
  source: "fmp" | "mock";
  apiCallsUsed: number;
}

export interface StockPoolData {
  meta: StockPoolMeta;
  stocks: StockMetrics[];
}

/**
 * Save the full stock pool to Firestore.
 */
export async function saveStockPool(
  stocks: StockMetrics[],
  source: "fmp" | "mock",
  apiCallsUsed: number
): Promise<StockPoolMeta> {
  const db = getDb();
  const meta: StockPoolMeta = {
    updatedAt: new Date().toISOString(),
    symbolCount: stocks.length,
    source,
    apiCallsUsed,
  };

  await db.collection(COLLECTION).doc(DOC_ID).set({
    meta,
    // Firestore needs plain objects
    stocks: stocks.map((s) => JSON.parse(JSON.stringify(s))),
  });

  return meta;
}

/**
 * Load the full stock pool from Firestore.
 * Returns null if no pool exists yet.
 */
export async function loadStockPool(): Promise<StockPoolData | null> {
  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (!data?.stocks || !data?.meta) return null;

    return {
      meta: data.meta as StockPoolMeta,
      stocks: data.stocks as StockMetrics[],
    };
  } catch (e) {
    console.error("Failed to load stock pool from Firestore:", e);
    return null;
  }
}

/**
 * Get just the pool metadata (without loading all stocks).
 */
export async function getPoolStatus(): Promise<StockPoolMeta | null> {
  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
    if (!doc.exists) return null;
    return (doc.data()?.meta as StockPoolMeta) ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if the pool is fresh enough (default: 12 hours).
 */
export function isPoolFresh(meta: StockPoolMeta, maxAgeHours = 12): boolean {
  const updatedAt = new Date(meta.updatedAt).getTime();
  const ageMs = Date.now() - updatedAt;
  return ageMs < maxAgeHours * 60 * 60 * 1000;
}
