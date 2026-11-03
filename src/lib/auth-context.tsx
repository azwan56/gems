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
  signInWithCustomToken,
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
const PROFILE_CACHE_PREFIX = "gems_profile_v1_";

function getSafeIdToken(fbUser: User | null, forceRefresh = false, timeoutMs = 2200): Promise<string | null> {
  if (!fbUser) return Promise.resolve(null);
  return Promise.race([
    fbUser.getIdToken(forceRefresh).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function readCachedProfile(uid: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed && parsed.uid === uid) {
      const { isPremium, isExpired } = isPlanPremium(parsed.planType || "trial", parsed.planEndDate);
      return { ...parsed, isPremium, isExpired };
    }
  } catch {}
  return null;
}

function writeCachedProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PROFILE_CACHE_PREFIX}${profile.uid}`, JSON.stringify(profile));
  } catch {}
}

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

  // Fetch or create user profile via same-origin API first (avoids browser firestore.googleapis.com stalls),
  // with a fast client-Firestore fallback
  const loadUserProfile = useCallback(async (fbUser: User): Promise<UserProfile> => {
    const token = await getSafeIdToken(fbUser, false, 2000);
    if (token) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const res = await fetch("/api/user-profile", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            const resolved: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || data.profile.email || null,
              displayName: fbUser.displayName || data.profile.displayName || null,
              photoURL: fbUser.photoURL || data.profile.photoURL || null,
              planType: (data.profile.planType as PlanType) || "trial",
              isPremium: Boolean(data.profile.isPremium),
              planEndDate: data.profile.planEndDate,
              isExpired: Boolean(data.profile.isExpired),
            };
            writeCachedProfile(resolved);
            return resolved;
          }
        }
      } catch {
        // Fall through to bounded Firestore lookup
      } finally {
        clearTimeout(timer);
      }
    }

    const db = getClientDb();
    const userRef = doc(db, "users", fbUser.uid);
    const snap = await Promise.race([
      getDoc(userRef),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);

    if (snap && snap.exists()) {
      const data = snap.data();
      const planType = (data.plan_type as PlanType) || "trial";
      const planEndDate = data.plan_end_date as string | undefined;
      const { isPremium, isExpired } = isPlanPremium(planType, planEndDate);

      const resolved: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || data.displayName || null,
        photoURL: fbUser.photoURL || data.photoURL || null,
        planType,
        isPremium,
        planEndDate,
        isExpired,
      };
      writeCachedProfile(resolved);
      return resolved;
    }

    if (!snap) {
      // Both network paths timed out: return cached profile or safe non-blocking fallback
      return (
        readCachedProfile(fbUser.uid) || {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
          planType: "trial",
          isPremium: false,
          isExpired: false,
        }
      );
    }

    // New user from Gems — create minimal profile
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const planEndDate = trialEnd.toISOString().split("T")[0];

    const newProfile = {
      email: fbUser.email,
      plan_type: "trial",
      plan_end_date: planEndDate,
      registered_from: "gems",
      created_at: serverTimestamp(),
    };
    await Promise.race([
      setDoc(userRef, newProfile, { merge: true }),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);

    const created: UserProfile = {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName,
      photoURL: fbUser.photoURL,
      planType: "trial",
      isPremium: false,
      planEndDate,
      isExpired: false,
    };
    writeCachedProfile(created);
    return created;
  }, []);

  // Handle cross-subdomain auth token from DailyStock
  // When user clicks the 💎 link on DailyStock, the URL contains ?authToken=xxx
  const handleCrossSubdomainAuth = useCallback(async () => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const incomingToken = url.searchParams.get("authToken");
    if (!incomingToken) return;

    // Clean the token from URL immediately to prevent leakage
    url.searchParams.delete("authToken");
    window.history.replaceState({}, "", url.toString());

    // Attempt exchange with one automatic retry for transient failures
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch("/api/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: incomingToken }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const errCode = body?.error || "UNKNOWN";

          if (errCode === "TOKEN_EXPIRED") {
            // Expired token — no point retrying with the same token
            console.warn("Cross-subdomain token expired. User needs to re-login on DailyStock.");
            setError("Your DailyStock session has expired. Please log in again on DailyStock and retry, or sign in directly here.");
            return;
          }

          // Transient error — retry once
          if (attempt < MAX_ATTEMPTS) {
            console.warn(`Cross-subdomain token exchange attempt ${attempt} failed (${errCode}), retrying...`);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          console.warn(`Cross-subdomain token exchange failed after ${MAX_ATTEMPTS} attempts:`, errCode);
          return;
        }

        const { customToken } = await res.json();
        const auth = getClientAuth();

        // Sign out existing user first if different account is cached
        if (auth.currentUser) {
          await firebaseSignOut(auth);
        }

        await signInWithCustomToken(auth, customToken);
        // onAuthStateChanged will pick up the new user automatically
        return;
      } catch (err) {
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`Cross-subdomain auth attempt ${attempt} threw, retrying...`, err);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        console.error("Cross-subdomain auth failed after retries:", err);
      }
    }
  }, []);

  // Listen to auth state changes (with hard 2.2s unlock guarantee)
  useEffect(() => {
    const auth = getClientAuth();
    const unlockTimer = setTimeout(() => {
      setLoading(false);
    }, 2200);

    // First try cross-subdomain auth, then listen for state changes
    handleCrossSubdomainAuth();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const cached = readCachedProfile(fbUser.uid);
        if (cached) {
          setUser(cached);
          clearTimeout(unlockTimer);
          setLoading(false);
        }
        try {
          const profile = await loadUserProfile(fbUser);
          setUser(profile);
        } catch (err) {
          console.error("Failed to load user profile:", err);
          if (!cached) {
            setUser({
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              planType: "trial",
              isPremium: false,
              isExpired: false,
            });
          }
        }
      } else {
        setUser(null);
      }
      clearTimeout(unlockTimer);
      setLoading(false);
    });

    return () => {
      clearTimeout(unlockTimer);
      unsubscribe();
    };
  }, [loadUserProfile, handleCrossSubdomainAuth]);

  // ---- Auth methods ----

  const getIdToken = useCallback(async (): Promise<string | null> => {
    return getSafeIdToken(firebaseUser, false, 2500);
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
