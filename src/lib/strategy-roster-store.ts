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
 * Load the roster for a specific strategy and year from Firestore.
 */
export async function getStrategyRoster(strategyId: string, year: number): Promise<StrategyRoster | null> {
  try {
    const db = getDb();
    const docId = `${strategyId}_${year}`;
    const doc = await db.collection(COLLECTION).doc(docId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as StrategyRoster;
    return data;
  } catch (e) {
    console.error(`Failed to load strategy roster for ${strategyId}_${year}:`, e);
    return null;
  }
}

/**
 * Update a strategy's roster by comparing new screener results against the existing roster.
 * - Annual Segmentation: Roster is isolated by current year.
 * - New stocks: Added with today's date and current price.
 * - Existing stocks (in this year's roster): Preserved with their original entry dates/prices in this year.
 * - Dropped stocks: Removed from the active roster.
 */
export async function updateStrategyRoster(
  strategyId: string,
  newStocks: StockMetrics[]
): Promise<StrategyRoster> {
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentYear = now.getFullYear();
  const docId = `${strategyId}_${currentYear}`;
  
  const existingRoster = await getStrategyRoster(strategyId, currentYear);
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
      // Keep existing first entry data from THIS YEAR
      updatedEntries.push({
        ...existing,
      });
    } else {
      // Brand new entry to the strategy IN THIS YEAR
      // Even if it existed in last year's roster, it is treated as a new entry
      // on the first trading day it passes the filter this year.
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
    strategyId, // Keep original strategyId for client reference
    entries: updatedEntries,
    updatedAt: now.toISOString(),
  };

  await db.collection(COLLECTION).doc(docId).set(newRoster);
  
  return newRoster;
}
