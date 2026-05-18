// ============================================================
// Firebase Admin SDK — singleton Firestore instance
// Uses FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string)
// or Application Default Credentials in production
// ============================================================

import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let db: Firestore | null = null;

function initFirestore(): Firestore {
  if (db) return db;

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

  db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export function getDb(): Firestore {
  return initFirestore();
}
