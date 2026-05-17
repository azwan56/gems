// ============================================================
// Firestore-backed user storage
// Collections: gems_watchlists, gems_strategies
// Falls back to in-memory store if Firestore is unavailable
// ============================================================

import { SavedStrategy, WatchlistItem } from "./types";
import { randomUUID } from "crypto";

// ---- In-memory fallback ----
const memWatchlists = new Map<string, WatchlistItem[]>();
const memStrategies = new Map<string, SavedStrategy[]>();

// ---- Firestore (lazy singleton) ----
let firestoreDb: FirebaseFirestore.Firestore | null | undefined = undefined; // undefined = not yet tried

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
    console.error("Firestore initialization failed, falling back to in-memory:", e);
    firestoreDb = null;
    return null;
  }
}

// ---- Watchlist ----

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  const db = await getFirestoreDb();
  if (!db) return memWatchlists.get(userId) ?? [];

  try {
    const snap = await db.collection("gems_watchlists").doc(userId).get();
    if (!snap.exists) return [];
    const data = snap.data();
    return (data?.items as WatchlistItem[]) ?? [];
  } catch (e) {
    console.error("Firestore read failed:", e);
    return memWatchlists.get(userId) ?? [];
  }
}

export async function addToWatchlist(
  userId: string,
  symbol: string,
  notes?: string
): Promise<WatchlistItem> {
  const list = await getWatchlist(userId);
  const upperSymbol = symbol.toUpperCase();

  // Prevent duplicates
  const existing = list.find((item) => item.symbol === upperSymbol);
  if (existing) {
    if (notes !== undefined) existing.notes = notes;
    await _persistWatchlist(userId, list);
    return existing;
  }

  const item: WatchlistItem = {
    symbol: upperSymbol,
    addedAt: new Date().toISOString(),
    notes,
  };
  list.push(item);
  await _persistWatchlist(userId, list);
  return item;
}

export async function removeFromWatchlist(userId: string, symbol: string): Promise<boolean> {
  const list = await getWatchlist(userId);
  const idx = list.findIndex((item) => item.symbol === symbol.toUpperCase());
  if (idx === -1) return false;
  list.splice(idx, 1);
  await _persistWatchlist(userId, list);
  return true;
}

export async function updateWatchlistRole(
  userId: string,
  symbol: string,
  role: WatchlistItem["role"]
): Promise<WatchlistItem | null> {
  const list = await getWatchlist(userId);
  const item = list.find((i) => i.symbol === symbol.toUpperCase());
  if (!item) return null;
  item.role = role;
  await _persistWatchlist(userId, list);
  return item;
}

async function _persistWatchlist(userId: string, items: WatchlistItem[]): Promise<void> {
  const db = await getFirestoreDb();
  if (db) {
    try {
      await db.collection("gems_watchlists").doc(userId).set({ items, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.error("Firestore write failed, storing in memory:", e);
      memWatchlists.set(userId, items);
    }
  } else {
    memWatchlists.set(userId, items);
  }
}

// ---- Saved Strategies ----

export async function getSavedStrategies(userId: string): Promise<SavedStrategy[]> {
  const db = await getFirestoreDb();
  if (!db) return memStrategies.get(userId) ?? [];

  try {
    const snap = await db.collection("gems_strategies").doc(userId).get();
    if (!snap.exists) return [];
    const data = snap.data();
    return (data?.strategies as SavedStrategy[]) ?? [];
  } catch (e) {
    console.error("Firestore read failed:", e);
    return memStrategies.get(userId) ?? [];
  }
}

export async function saveStrategy(
  userId: string,
  strategy: Omit<SavedStrategy, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<SavedStrategy> {
  const list = await getSavedStrategies(userId);
  const now = new Date().toISOString();
  const saved: SavedStrategy = {
    id: randomUUID(),
    userId,
    ...strategy,
    createdAt: now,
    updatedAt: now,
  };
  list.push(saved);
  await _persistStrategies(userId, list);
  return saved;
}

export async function deleteStrategy(userId: string, strategyId: string): Promise<boolean> {
  const list = await getSavedStrategies(userId);
  const idx = list.findIndex((s) => s.id === strategyId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  await _persistStrategies(userId, list);
  return true;
}

async function _persistStrategies(userId: string, strategies: SavedStrategy[]): Promise<void> {
  const db = await getFirestoreDb();
  if (db) {
    try {
      await db.collection("gems_strategies").doc(userId).set({ strategies, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.error("Firestore write failed, storing in memory:", e);
      memStrategies.set(userId, strategies);
    }
  } else {
    memStrategies.set(userId, strategies);
  }
}

/** Clear all data — useful for testing */
export async function clearAllUserData(): Promise<void> {
  memWatchlists.clear();
  memStrategies.clear();
}
