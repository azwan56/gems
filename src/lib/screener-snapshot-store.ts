// ============================================================
// Screener Snapshot Store — persists screener results per strategy
// so we can diff to detect newly qualifying stocks.
// Collection: gems_screener_snapshots
// ============================================================

import { StockMetrics } from "./types";

// ---- Types ----

export interface ScreenerSnapshot {
  strategyId: string;
  symbols: string[];
  /** Key metrics for each symbol, keyed by uppercase symbol */
  metrics: Record<string, SnapshotStockSummary>;
  symbolCount: number;
  updatedAt: string;
}

export interface SnapshotStockSummary {
  symbol: string;
  companyName: string;
  marketCap: number;
  peRatio: number | null;
  pbRatio: number | null;
  freeCashFlowYield: number | null;
  revenueGrowthYoY: number | null;
  epsGrowthYoY: number | null;
  grossMargin: number | null;
  priceVs50SMA: number | null;
}

export interface ScreenerDiff {
  strategyId: string;
  strategyName: string;
  strategyNameZh: string;
  added: SnapshotStockSummary[];
  removed: string[];
  currentCount: number;
  previousCount: number;
}

// ---- Helpers ----

/** Extract a lightweight summary from full StockMetrics */
export function toStockSummary(stock: StockMetrics): SnapshotStockSummary {
  return {
    symbol: stock.symbol,
    companyName: stock.companyName,
    marketCap: stock.marketCap,
    peRatio: stock.peRatio,
    pbRatio: stock.pbRatio,
    freeCashFlowYield: stock.freeCashFlowYield,
    revenueGrowthYoY: stock.revenueGrowthYoY,
    epsGrowthYoY: stock.epsGrowthYoY,
    grossMargin: stock.grossMargin,
    priceVs50SMA: stock.priceVs50SMA,
  };
}

// ---- In-memory fallback ----

const memSnapshots = new Map<string, ScreenerSnapshot>();

// ---- Firestore (lazy singleton) ----

let firestoreDb: FirebaseFirestore.Firestore | null | undefined = undefined;

async function getFirestoreDb(): Promise<FirebaseFirestore.Firestore | null> {
  if (firestoreDb !== undefined) return firestoreDb;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    firestoreDb = null;
    return null;
  }

  try {
    const { getDb } = await import("./firebase");
    firestoreDb = getDb();
    return firestoreDb;
  } catch (e) {
    console.error("[screener-snapshot] Firestore init failed, falling back to in-memory:", e);
    firestoreDb = null;
    return null;
  }
}

const COLLECTION = "gems_screener_snapshots";

// ============================================================
// CRUD
// ============================================================

/**
 * Save a screener snapshot for a given strategy.
 */
export async function saveScreenerSnapshot(
  strategyId: string,
  stocks: StockMetrics[]
): Promise<ScreenerSnapshot> {
  const symbols = stocks.map((s) => s.symbol.toUpperCase());
  const metrics: Record<string, SnapshotStockSummary> = {};
  for (const s of stocks) {
    metrics[s.symbol.toUpperCase()] = toStockSummary(s);
  }

  const snapshot: ScreenerSnapshot = {
    strategyId,
    symbols,
    metrics,
    symbolCount: symbols.length,
    updatedAt: new Date().toISOString(),
  };

  const db = await getFirestoreDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(strategyId).set(snapshot);
    } catch (e) {
      console.error("[screener-snapshot] Write failed:", e);
      memSnapshots.set(strategyId, snapshot);
    }
  } else {
    memSnapshots.set(strategyId, snapshot);
  }

  return snapshot;
}

/**
 * Load the previous screener snapshot for a given strategy.
 */
export async function loadScreenerSnapshot(
  strategyId: string
): Promise<ScreenerSnapshot | null> {
  const db = await getFirestoreDb();
  if (!db) return memSnapshots.get(strategyId) ?? null;

  try {
    const doc = await db.collection(COLLECTION).doc(strategyId).get();
    if (!doc.exists) return null;
    return doc.data() as ScreenerSnapshot;
  } catch (e) {
    console.error("[screener-snapshot] Read failed:", e);
    return memSnapshots.get(strategyId) ?? null;
  }
}

// ============================================================
// Diff
// ============================================================

/**
 * Compare two snapshots and return added/removed symbols.
 *
 * @param previous - The previous snapshot (null if first run)
 * @param currentStocks - The current screener results
 * @param strategyId - The strategy identifier
 * @param strategyName - Human-readable strategy name (English)
 * @param strategyNameZh - Human-readable strategy name (Chinese)
 */
export function diffSnapshots(
  previous: ScreenerSnapshot | null,
  currentStocks: StockMetrics[],
  strategyId: string,
  strategyName: string,
  strategyNameZh: string
): ScreenerDiff {
  const currentSymbols = new Set(currentStocks.map((s) => s.symbol.toUpperCase()));
  const previousSymbols = new Set(previous?.symbols.map((s) => s.toUpperCase()) ?? []);

  // New: in current but not in previous
  const addedSymbols = [...currentSymbols].filter((s) => !previousSymbols.has(s));
  const added = addedSymbols.map((sym) => {
    const stock = currentStocks.find((s) => s.symbol.toUpperCase() === sym);
    return stock ? toStockSummary(stock) : { symbol: sym, companyName: "", marketCap: 0, peRatio: null, pbRatio: null, freeCashFlowYield: null, revenueGrowthYoY: null, epsGrowthYoY: null, grossMargin: null, priceVs50SMA: null };
  });

  // Removed: in previous but not in current
  const removed = [...previousSymbols].filter((s) => !currentSymbols.has(s));

  return {
    strategyId,
    strategyName,
    strategyNameZh,
    added,
    removed,
    currentCount: currentSymbols.size,
    previousCount: previousSymbols.size,
  };
}
