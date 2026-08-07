// ============================================================
// Seeking Alpha Custom List Store — Firestore backed
// Stores a user-curated list of symbols imported from SA
// ============================================================

import { getDb } from "./firebase";

const COLLECTION = "seeking_alpha_list";
const DOC_ID = "symbols";

export interface SeekingAlphaList {
  symbols: string[];
  updatedAt: string;
}

/** Entry info stored alongside SA symbols */
export interface SASymbolEntry {
  symbol: string;
  /** ISO date when first added to the SA list (used as firstEntryDate) */
  entryDate: string;
}

export interface SeekingAlphaListV2 {
  entries: SASymbolEntry[];
  /** Backward-compat flat list of symbols */
  symbols: string[];
  updatedAt: string;
}

let cachedSAList: SeekingAlphaList | null = null;
let saListCacheExpiry = 0;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Load the Seeking Alpha symbol list from Firestore.
 * Symbols are filtered at read time to exclude stocks that FMP
 * reports as not actively trading. No hardcoded blacklist required.
 */
export async function loadSAList(): Promise<SeekingAlphaList> {
  const now = Date.now();
  if (cachedSAList && now < saListCacheExpiry) {
    return cachedSAList;
  }

  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
    if (!doc.exists) {
      cachedSAList = { symbols: [], updatedAt: new Date().toISOString() };
      saListCacheExpiry = now + CACHE_TTL_MS;
      return cachedSAList;
    }
    const data = doc.data();
    const rawSymbols = (data?.symbols as string[]) ?? [];

    cachedSAList = {
      symbols: rawSymbols.map((s) => s.toUpperCase().trim()).filter(Boolean),
      updatedAt: (data?.updatedAt as string) ?? new Date().toISOString(),
    };
    saListCacheExpiry = now + CACHE_TTL_MS;
    return cachedSAList;
  } catch (e) {
    console.error("Failed to load SA list from Firestore:", e);
    return { symbols: [], updatedAt: new Date().toISOString() };
  }
}

/**
 * Load symbol entries with their import dates.
 * Falls back to the flat symbols list if no entries are stored yet.
 */
export async function loadSAEntries(): Promise<SASymbolEntry[]> {
  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
    if (!doc.exists) return [];
    const data = doc.data();
    if (data?.entries && Array.isArray(data.entries) && data.entries.length > 0) {
      return data.entries as SASymbolEntry[];
    }
    // Migrate from flat list: backfill with document updatedAt date (or fallback to today)
    const docDate = data?.updatedAt ? String(data.updatedAt).split("T")[0] : new Date().toISOString().split("T")[0];
    const symbols: string[] = (data?.symbols as string[]) ?? [];
    const entries = symbols.map((s) => ({ symbol: s.toUpperCase(), entryDate: docDate }));
    
    // Automatically persist back to Firestore so entry dates are permanently locked
    if (entries.length > 0) {
      await db.collection(COLLECTION).doc(DOC_ID).set(
        { entries },
        { merge: true }
      ).catch(() => {/* ignore */});
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Save the full Seeking Alpha symbol list to Firestore.
 * Also persists per-symbol entry dates.
 */
export async function saveSAList(
  symbols: string[],
  entryDateOverrides?: Record<string, string>
): Promise<SeekingAlphaList> {
  // Invalidate local cache
  cachedSAList = null;
  saListCacheExpiry = 0;

  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  const deduped = [...new Set(symbols.map((s) => s.toUpperCase().trim()).filter(Boolean))];

  // Load existing entries to preserve original entry dates
  const existingEntries = await loadSAEntries();
  const existingDateMap: Record<string, string> = {};
  for (const e of existingEntries) {
    existingDateMap[e.symbol] = e.entryDate;
  }

  const entries: SASymbolEntry[] = deduped.map((symbol) => ({
    symbol,
    entryDate: entryDateOverrides?.[symbol] ?? existingDateMap[symbol] ?? today,
  }));

  const record = {
    symbols: deduped,
    entries,
    updatedAt: new Date().toISOString(),
  };
  await db.collection(COLLECTION).doc(DOC_ID).set(record);
  return { symbols: deduped, updatedAt: record.updatedAt };
}

/**
 * Add one or more symbols to the SA list.
 * Records today as their firstEntryDate if not already present.
 */
export async function addToSAList(newSymbols: string[]): Promise<SeekingAlphaList> {
  const current = await loadSAList();
  const merged = [...new Set([...current.symbols, ...newSymbols.map((s) => s.toUpperCase().trim())])].filter(Boolean);
  // New symbols get today as their entryDate; existing ones preserve theirs (handled in saveSAList)
  return saveSAList(merged);
}

/**
 * Remove a symbol from the SA list.
 */
export async function removeFromSAList(symbol: string): Promise<SeekingAlphaList> {
  const current = await loadSAList();
  const filtered = current.symbols.filter((s) => s !== symbol.toUpperCase().trim());
  return saveSAList(filtered);
}
