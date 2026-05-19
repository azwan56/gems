// ============================================================
// Server-side Auth Middleware — verifies Firebase ID tokens
// on API routes. Uses firebase-admin (already configured).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "./firebase";

// ---- Types ----

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  tier: string;
  isPremium: boolean;
}

type AuthResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; response: NextResponse };

// Premium tiers that have access to Gems features
const PREMIUM_TIERS = ["premium", "elite", "super_elite"];

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
    // Use firebase-admin to verify the token
    const { getAuth } = await import("firebase-admin/auth");
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Fetch user tier from Firestore
    const db = getDb();
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();
    const tier = userData?.tier || "free";

    return {
      success: true,
      user: {
        uid,
        email: decodedToken.email,
        tier,
        isPremium: PREMIUM_TIERS.includes(tier),
      },
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return {
      success: false,
      response: NextResponse.json(
        { error: "INVALID_TOKEN", message: "Firebase ID token is invalid or expired" },
        { status: 401 }
      ),
    };
  }
}

/**
 * Verify auth AND require premium tier.
 * Returns the authenticated premium user or an error response.
 */
export async function requirePremium(request: NextRequest): Promise<AuthResult> {
  const authResult = await verifyAuth(request);

  if (!authResult.success) return authResult;

  if (!authResult.user.isPremium) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "PREMIUM_REQUIRED",
          message: "This feature requires a premium subscription. Please upgrade your plan.",
        },
        { status: 403 }
      ),
    };
  }

  return authResult;
}
