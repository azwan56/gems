// ============================================================
// POST /api/exchange-token
// Accepts a Firebase ID Token (from DailyStock), verifies it,
// and returns a Custom Token that Gems can use to sign in the
// same user seamlessly across subdomains.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { ensureInitialized } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "MISSING_TOKEN", message: "idToken is required" },
        { status: 400 }
      );
    }

    // Verify the incoming ID token using Firebase Admin
    ensureInitialized();
    const { getAuth } = await import("firebase-admin/auth");
    const adminAuth = getAuth();

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Create a custom token for this user so the Gems client can sign in
    const customToken = await adminAuth.createCustomToken(uid);

    return NextResponse.json({ customToken });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("exchange-token failed:", errMsg);
    return NextResponse.json(
      { error: "TOKEN_EXCHANGE_FAILED", message: errMsg },
      { status: 401 }
    );
  }
}
