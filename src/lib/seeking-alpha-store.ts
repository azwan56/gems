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

/**
 * Load the Seeking Alpha symbol list from Firestore.
 */
export async function loadSAList(): Promise<SeekingAlphaList> {
  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
    if (!doc.exists) {
      return { symbols: [], updatedAt: new Date().toISOString() };
    }
    const data = doc.data();
    return {
      symbols: (data?.symbols as string[]) ?? [],
      updatedAt: (data?.updatedAt as string) ?? new Date().toISOString(),
    };
  } catch (e) {
    console.error("Failed to load SA list from Firestore:", e);
    return { symbols: [], updatedAt: new Date().toISOString() };
  }
}

/**
 * Save the full Seeking Alpha symbol list to Firestore.
 */
export async function saveSAList(symbols: string[]): Promise<SeekingAlphaList> {
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
