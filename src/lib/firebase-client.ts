// ============================================================
// Firebase Client SDK — for browser-side authentication
// Shares the same Firebase project (dailystockrpt) as DailyStock,
// so users registered on either platform can log in seamlessly.
// ============================================================

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dailystockrpt.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dailystockrpt",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dailystockrpt.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let clientDb: Firestore | null = null;

function getClientApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return app;
}

export function getClientAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getClientApp());
  return auth;
}

export function getClientDb(): Firestore {
  if (clientDb) return clientDb;
  clientDb = getFirestore(getClientApp());
  return clientDb;
}
