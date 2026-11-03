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

const ALLOWED_ORIGINS = new Set([
  "https://dailystock.vanpower.live",
  "https://dailystockrpt.web.app",
  "https://dailystockrpt.firebaseapp.com",
  "https://gems.vanpower.live",
]);

function withCors(response: NextResponse, origin: string | null) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return withCors(new NextResponse(null, { status: 204 }), origin);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      return withCors(
        NextResponse.json(
          { error: "MISSING_TOKEN", message: "idToken is required" },
          { status: 400 }
        ),
        origin
      );
    }

    // Verify the incoming ID token using Firebase Admin
    ensureInitialized();
    const { getAuth } = await import("firebase-admin/auth");
    const adminAuth = getAuth();

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Create a custom token for this user so the client can sign in across subdomains
    const customToken = await adminAuth.createCustomToken(uid);

    return withCors(NextResponse.json({ customToken }), origin);
  } catch (error) {
    const errCode = (error as { code?: string })?.code || "UNKNOWN";
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`exchange-token failed [${errCode}]:`, errMsg);

    const isExpired =
      errCode === "auth/id-token-expired" ||
      errMsg.includes("expired") ||
      errMsg.includes("Firebase ID token has expired");

    return withCors(
      NextResponse.json(
        {
          error: isExpired ? "TOKEN_EXPIRED" : "TOKEN_EXCHANGE_FAILED",
          code: errCode,
          message: isExpired
            ? "The authentication token has expired. Please log in again and retry."
            : errMsg,
        },
        { status: 401 }
      ),
      origin
    );
  }
}
