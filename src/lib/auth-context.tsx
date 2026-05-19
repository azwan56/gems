// ============================================================
// Auth Context — global authentication state for Gems
// Provides user info, login/logout functions, and premium status.
// Uses Firebase Auth (shared with DailyStock platform).
// ============================================================

"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getClientAuth, getClientDb } from "./firebase-client";

// ---- Types ----

/** Maps to DailyStock's `plan_type` field in Firestore `users` collection */
export type PlanType = "trial" | "paid" | "super";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** DailyStock plan type: trial, paid, super */
  planType: PlanType;
  /** Whether the user has paid access (paid or super) */
  isPremium: boolean;
  /** Plan expiry date string (YYYY-MM-DD) */
  planEndDate?: string;
  /** Whether the plan has expired */
  isExpired: boolean;
}

interface AuthContextValue {
  user: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  /** Get the current user's ID token for API auth */
  getIdToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---- Premium check ----

/** paid and super users have premium access */
const PREMIUM_PLANS: PlanType[] = ["paid", "super"];

function isPlanPremium(planType: PlanType, planEndDate?: string): { isPremium: boolean; isExpired: boolean } {
  if (!PREMIUM_PLANS.includes(planType)) {
    return { isPremium: false, isExpired: false };
  }
  // Check expiry
  if (planEndDate) {
    const expiry = new Date(planEndDate);
    const now = new Date();
    if (expiry < now) {
      return { isPremium: false, isExpired: true };
    }
  }
  return { isPremium: true, isExpired: false };
}

// ---- Provider ----

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch or create user profile from Firestore
  const loadUserProfile = useCallback(async (fbUser: User): Promise<UserProfile> => {
    const db = getClientDb();
    const userRef = doc(db, "users", fbUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      // DailyStock uses `plan_type` field with values: trial, paid, super
      const planType = (data.plan_type as PlanType) || "trial";
      const planEndDate = data.plan_end_date as string | undefined;
      const { isPremium, isExpired } = isPlanPremium(planType, planEndDate);

      return {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || data.displayName || null,
        photoURL: fbUser.photoURL || data.photoURL || null,
        planType,
        isPremium,
        planEndDate,
        isExpired,
      };
    }

    // New user from Gems — create profile matching DailyStock schema
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days trial
    const planEndDate = trialEnd.toISOString().split("T")[0];

    const newProfile = {
      email: fbUser.email,
      plan_type: "trial",
      plan_end_date: planEndDate,
      language: "zh-CN",
      timezone: "Asia/Shanghai",
      watchlist: [],
      created_at: serverTimestamp(),
    };
    await setDoc(userRef, newProfile, { merge: true });

    return {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName,
      photoURL: fbUser.photoURL,
      planType: "trial",
      isPremium: false,
      planEndDate,
      isExpired: false,
    };
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const profile = await loadUserProfile(fbUser);
          setUser(profile);
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadUserProfile]);

  // ---- Auth methods ----

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!firebaseUser) return null;
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const auth = getClientAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      setError(msg);
      throw err;
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Email sign-in failed";
      setError(msg);
      throw err;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const auth = getClientAuth();
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = getClientAuth();
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        error,
        getIdToken,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---- Hook ----

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
