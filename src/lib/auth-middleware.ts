// ============================================================
// Server-side Auth Middleware — verifies Firebase ID tokens
// on API routes. Uses firebase-admin (already configured).
// Reads `plan_type` and `plan_end_date` from Firestore `users`
// collection (shared with DailyStock platform).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureInitialized } from "./firebase";

// ---- Types ----

export type PlanType = "trial" | "paid" | "super";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  planType: PlanType;
  isPremium: boolean;
  isExpired: boolean;
}

type AuthResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; response: NextResponse };

// paid and super users have premium access
const PREMIUM_PLANS: PlanType[] = ["paid", "super"];

// ---- Token Verification ----

/**
 * Verify Firebase ID token from Authorization header.
 * Returns the authenticated user or an error response.
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" },
        { status: 401 }
      ),
    };
  }

  const idToken = authHeader.slice(7); // Remove "Bearer "

  try {
    // Ensure Firebase Admin is initialized before using Auth
    ensureInitialized();
    const { getAuth } = await import("firebase-admin/auth");
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Fetch user plan from Firestore (DailyStock schema)
    const db = getDb();
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();
    const planType = (userData?.plan_type as PlanType) || "trial";
    const planEndDate = userData?.plan_end_date as string | undefined;

    // Check if plan is premium and not expired
    let isPremium = PREMIUM_PLANS.includes(planType);
    let isExpired = false;
    if (isPremium && planEndDate) {
      const expiry = new Date(planEndDate);
      if (expiry < new Date()) {
        isPremium = false;
        isExpired = true;
      }
    }

    return {
      success: true,
      user: { uid, email: decodedToken.email, planType, isPremium, isExpired },
    };
  } catch (error) {
    const errCode = (error as { code?: string })?.code || "UNKNOWN";
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Token verification failed [${errCode}]:`, errMsg);
    return {
      success: false,
      response: NextResponse.json(
        { error: "INVALID_TOKEN", code: errCode, message: `Firebase ID token is invalid or expired (${errCode})` },
        { status: 401 }
      ),
    };
  }
}

/**
 * Verify auth AND require premium plan (paid or super).
 * Returns the authenticated premium user or an error response.
 */
export async function requirePremium(request: NextRequest): Promise<AuthResult> {
  const authResult = await verifyAuth(request);

  if (!authResult.success) return authResult;

  if (!authResult.user.isPremium) {
    const message = authResult.user.isExpired
      ? "Your premium plan has expired. Please renew to continue using this feature."
      : "This feature requires a paid subscription. Please upgrade your plan.";

    return {
      success: false,
      response: NextResponse.json(
        { error: "PREMIUM_REQUIRED", message },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

