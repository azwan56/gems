// ============================================================
// Firestore-backed storage for Rebalance webhooks & snapshots
// Collections: gems_rebalance_webhooks, gems_rebalance_snapshots
// Follows the pattern in user-store.ts
// ============================================================

import { MacroDriftResult, WindowDressingResult } from "./rebalance-engine";

// ---- Types ----

export interface UserWebhookConfig {
  webhookUrl: string;
  enabled: boolean;
  /** Optional email for email notifications (alongside Discord) */
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertSnapshot {
  date: string;
  period: "MTD" | "QTD";
  macro: MacroDriftResult;
  micro: WindowDressingResult | null;
  alertsSent: number;
  createdAt: string;
}

// ---- In-memory fallback ----
const memWebhooks = new Map<string, UserWebhookConfig>();
const memSnapshots: AlertSnapshot[] = [];

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
    console.error("[rebalance-store] Firestore init failed, falling back to in-memory:", e);
    firestoreDb = null;
    return null;
  }
}

// ============================================================
// Webhook CRUD
// ============================================================

const WEBHOOK_COLLECTION = "gems_rebalance_webhooks";

/**
 * Get a user's webhook configuration.
 */
export async function getUserWebhook(userId: string): Promise<UserWebhookConfig | null> {
  const db = await getFirestoreDb();
  if (!db) return memWebhooks.get(userId) ?? null;

  try {
    const snap = await db.collection(WEBHOOK_COLLECTION).doc(userId).get();
    if (!snap.exists) return null;
    return snap.data() as UserWebhookConfig;
  } catch (e) {
    console.error("[rebalance-store] Read webhook failed:", e);
    return memWebhooks.get(userId) ?? null;
  }
}

/**
 * Save or update a user's webhook configuration.
 */
export async function setUserWebhook(
  userId: string,
  webhookUrl: string,
  enabled: boolean,
  email?: string
): Promise<UserWebhookConfig> {
  const now = new Date().toISOString();
  const existing = await getUserWebhook(userId);

  const config: UserWebhookConfig = {
    webhookUrl,
    enabled,
    email: email ?? existing?.email,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const db = await getFirestoreDb();
  if (db) {
    try {
      await db.collection(WEBHOOK_COLLECTION).doc(userId).set(config);
    } catch (e) {
      console.error("[rebalance-store] Write webhook failed:", e);
      memWebhooks.set(userId, config);
    }
  } else {
    memWebhooks.set(userId, config);
  }

  return config;
}

/**
 * Delete a user's webhook configuration.
 */
export async function deleteUserWebhook(userId: string): Promise<boolean> {
  const db = await getFirestoreDb();
  if (db) {
    try {
      await db.collection(WEBHOOK_COLLECTION).doc(userId).delete();
      return true;
    } catch (e) {
      console.error("[rebalance-store] Delete webhook failed:", e);
      memWebhooks.delete(userId);
      return true;
    }
  } else {
    return memWebhooks.delete(userId);
  }
}

/**
 * Get all enabled user webhooks (for cron fan-out).
 */
export async function getAllEnabledWebhooks(): Promise<{ userId: string; webhookUrl: string }[]> {
  const db = await getFirestoreDb();
  if (!db) {
    const results: { userId: string; webhookUrl: string }[] = [];
    for (const [userId, config] of memWebhooks.entries()) {
      if (config.enabled && config.webhookUrl) {
        results.push({ userId, webhookUrl: config.webhookUrl });
      }
    }
    return results;
  }

  try {
    const snap = await db
      .collection(WEBHOOK_COLLECTION)
      .where("enabled", "==", true)
      .get();

    return snap.docs
      .filter((d) => d.data().webhookUrl)
      .map((d) => ({ userId: d.id, webhookUrl: d.data().webhookUrl as string }));
  } catch (e) {
    console.error("[rebalance-store] Read all webhooks failed:", e);
    return [];
  }
}

/**
 * Get all enabled user emails (for email fan-out).
 * Returns users that have both enabled=true and a non-empty email.
 */
export async function getAllEnabledEmails(): Promise<{ userId: string; email: string }[]> {
  const db = await getFirestoreDb();
  if (!db) {
    const results: { userId: string; email: string }[] = [];
    for (const [userId, config] of memWebhooks.entries()) {
      if (config.enabled && config.email) {
        results.push({ userId, email: config.email });
      }
    }
    return results;
  }

  try {
    const snap = await db
      .collection(WEBHOOK_COLLECTION)
      .where("enabled", "==", true)
      .get();

    return snap.docs
      .filter((d) => d.data().email)
      .map((d) => ({ userId: d.id, email: d.data().email as string }));
  } catch (e) {
    console.error("[rebalance-store] Read all emails failed:", e);
    return [];
  }
}

// ============================================================
// Alert Snapshots
// ============================================================

const SNAPSHOT_COLLECTION = "gems_rebalance_snapshots";

/**
 * Save an alert snapshot (keyed by date).
 */
export async function saveAlertSnapshot(snapshot: AlertSnapshot): Promise<void> {
  const db = await getFirestoreDb();
  if (db) {
    try {
      await db.collection(SNAPSHOT_COLLECTION).doc(snapshot.date).set(snapshot);
    } catch (e) {
      console.error("[rebalance-store] Write snapshot failed:", e);
      memSnapshots.unshift(snapshot);
    }
  } else {
    // Keep max 30 in memory
    memSnapshots.unshift(snapshot);
    if (memSnapshots.length > 30) memSnapshots.pop();
  }
}

/**
 * Get the latest N snapshots, newest first.
 */
export async function getLatestSnapshots(limit: number = 10): Promise<AlertSnapshot[]> {
  const db = await getFirestoreDb();
  if (!db) return memSnapshots.slice(0, limit);

  try {
    const snap = await db
      .collection(SNAPSHOT_COLLECTION)
      .orderBy("date", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((d) => d.data() as AlertSnapshot);
  } catch (e) {
    console.error("[rebalance-store] Read snapshots failed:", e);
    return memSnapshots.slice(0, limit);
  }
}
