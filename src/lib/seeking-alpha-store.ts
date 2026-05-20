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

let cachedSAList: SeekingAlphaList | null = null;
let saListCacheExpiry = 0;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Load the Seeking Alpha symbol list from Firestore.
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
    cachedSAList = {
      symbols: (data?.symbols as string[]) ?? [],
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
 * Save the full Seeking Alpha symbol list to Firestore.
 */
export async function saveSAList(symbols: string[]): Promise<SeekingAlphaList> {
  // Invalidate local cache
  cachedSAList = null;
  saListCacheExpiry = 0;

  const db = getDb();
  const deduped = [...new Set(symbols.map((s) => s.toUpperCase().trim()).filter(Boolean))];
  const record: SeekingAlphaList = {
    symbols: deduped,
    updatedAt: new Date().toISOString(),
  };
  await db.collection(COLLECTION).doc(DOC_ID).set(record);
  return record;
}

/**
 * Add one or more symbols to the SA list (deduplicates).
 */
export async function addToSAList(newSymbols: string[]): Promise<SeekingAlphaList> {
  const current = await loadSAList();
  const merged = [...new Set([...current.symbols, ...newSymbols.map((s) => s.toUpperCase().trim())])].filter(Boolean);
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
