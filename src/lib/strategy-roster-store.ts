// ============================================================
// Strategy Roster Store — Firestore backed
// Persists the quantitative screener results to allow backtesting
// and accurate historical tracking of entry dates & prices.
// ============================================================

import { getDb } from "./firebase";
import { StockMetrics } from "./types";

const COLLECTION = "strategy_rosters";

export interface RosterEntry {
  symbol: string;
  firstEntryDate: string;
  firstEntryPrice: number;
  latestEntryDate: string;
  latestEntryPrice: number;
}

export interface StrategyRoster {
  strategyId: string;
  entries: RosterEntry[];
  updatedAt: string;
}

/**
 * Load the roster for a specific strategy from Firestore.
 */
export async function getStrategyRoster(strategyId: string): Promise<StrategyRoster | null> {
  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(strategyId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as StrategyRoster;
    return data;
  } catch (e) {
    console.error(`Failed to load strategy roster for ${strategyId}:`, e);
    return null;
  }
}

/**
 * Update a strategy's roster by comparing new screener results against the existing roster.
 * - New stocks: Added with today's date and current price.
 * - Existing stocks: Preserved with their original entry dates/prices, but latest entry updated if rebalanced.
 * - Dropped stocks: Removed from the active roster.
 */
export async function updateStrategyRoster(
  strategyId: string,
  newStocks: StockMetrics[]
): Promise<StrategyRoster> {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  
  const existingRoster = await getStrategyRoster(strategyId);
  const existingMap = new Map<string, RosterEntry>();
  
  if (existingRoster?.entries) {
    for (const e of existingRoster.entries) {
      existingMap.set(e.symbol.toUpperCase(), e);
    }
  }

  const updatedEntries: RosterEntry[] = [];

  for (const stock of newStocks) {
    const symbol = stock.symbol.toUpperCase();
    const currentPrice = stock.price || 0;
    const existing = existingMap.get(symbol);

    if (existing) {
      // Keep existing first entry data, but update latest entry to today if needed 
      // (For now, we just keep the existing data intact to track the original entry)
      updatedEntries.push({
        ...existing,
        // We could optionally update latestEntryDate/Price here if we define a rebalance logic,
        // but for simple hold tracking, keeping the original is best.
      });
    } else {
      // Brand new entry to the strategy
      updatedEntries.push({
        symbol,
        firstEntryDate: today,
        firstEntryPrice: currentPrice,
        latestEntryDate: today,
        latestEntryPrice: currentPrice,
      });
    }
  }

  const newRoster: StrategyRoster = {
    strategyId,
    entries: updatedEntries,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(COLLECTION).doc(strategyId).set(newRoster);
  
  return newRoster;
}
