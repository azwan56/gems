// ============================================================
// POST /api/share — Create a shareable report link
// Stores analysis data in Firestore and returns a share ID.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const { symbol, strategy, strategyName, report, metrics } = body;

    if (!symbol || !report) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "symbol and report are required" },
        { status: 400 }
      );
    }

    const shareId = randomUUID().replace(/-/g, "").slice(0, 16);

    // Persist to Firestore
    try {
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();
      await db.collection("gems_share_cards").doc(shareId).set({
        id: shareId,
        symbol,
        strategy: strategy || "value",
        strategyName: strategyName || "",
        report,
        metrics: metrics || {},
        createdBy: authResult.user.uid,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Firestore write failed for share card:", e);
      // Still return the shareId — card will work, just QR landing won't
    }

    return NextResponse.json({ shareId });
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }
}
