// ============================================================
// Firebase Admin SDK — singleton Firestore instance
// Uses FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string)
// or Application Default Credentials in production
// ============================================================

import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Use globalThis to persist across Next.js hot-reloads in dev mode
const globalForFirebase = globalThis as unknown as {
  _firestore?: Firestore;
};

function initFirestore(): Firestore {
  if (globalForFirebase._firestore) return globalForFirebase._firestore;

  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
        initializeApp({ credential: cert(serviceAccount) });
      } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
        throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY");
      }
    } else {
      // Fallback to Application Default Credentials (e.g. on GCP, or with GOOGLE_APPLICATION_CREDENTIALS)
      initializeApp();
    }
  }

  const db = getFirestore();
  // settings() can only be called once before any other Firestore method
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already configured — safe to ignore in hot-reload scenarios
  }
  globalForFirebase._firestore = db;
  return db;
}

export function getDb(): Firestore {
  return initFirestore();
}
