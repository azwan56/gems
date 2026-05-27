// ============================================================
// POST /api/exchange-token
// Accepts a Firebase ID Token (from DailyStock), verifies it,
// and returns a Custom Token that Gems can use to sign in the
// same user seamlessly across subdomains.
//
// Enhanced: distinguishes expired vs invalid tokens and returns
// structured error codes so the client can decide whether to
// prompt a manual login or show a transient toast.
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
    const errCode = (error as { code?: string })?.code || "UNKNOWN";
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`exchange-token failed [${errCode}]:`, errMsg);

    // Distinguish between expired and otherwise-invalid tokens so the
    // client can show an appropriate message (e.g. "please log in again"
    // vs a generic "authentication failed" toast).
    const isExpired =
      errCode === "auth/id-token-expired" ||
      errMsg.includes("expired") ||
      errMsg.includes("Firebase ID token has expired");

    return NextResponse.json(
      {
        error: isExpired ? "TOKEN_EXPIRED" : "TOKEN_EXCHANGE_FAILED",
        code: errCode,
        message: isExpired
          ? "The authentication token has expired. Please log in again on DailyStock and retry."
          : errMsg,
      },
      { status: 401 }
    );
  }
}
