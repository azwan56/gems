// ============================================================
// POST /api/sync-dailystock — Sync a single stock to DailyStock observe_list
// Appends a symbol to the user's observe_list field on the shared
// Firestore `users/{uid}` document (same DB as DailyStock platform).
// Respects DailyStock plan limits: trial=2, paid=5, super=unlimited.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/firebase";

// DailyStock observe_list limits per plan type
const OBSERVE_LIMITS: Record<string, number> = {
  trial: 2,
  paid: 5,
  super: Infinity,
};

export async function POST(request: NextRequest) {
  // 1. Verify auth
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  const { uid, planType } = authResult.user;

  // 2. Parse request body
  let symbol: string;
  try {
    const body = await request.json();
    symbol = body.symbol?.toUpperCase?.();
    if (!symbol) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "symbol is required" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};

    const observeList: string[] = (userData.observe_list as string[]) || [];

    // 3. Check if already in observe_list
    if (observeList.includes(symbol)) {
      return NextResponse.json({
        status: "already_exists",
        message: `${symbol} is already in your DailyStock observe list`,
        observe_list: observeList,
      });
    }

    // 4. Check plan limits
    const limit = OBSERVE_LIMITS[planType] ?? OBSERVE_LIMITS.trial;
    if (observeList.length >= limit) {
      return NextResponse.json(
        {
          error: "PLAN_LIMIT_EXCEEDED",
          message: `Your ${planType} plan allows up to ${limit} observe stocks. Current: ${observeList.length}.`,
          limit,
          current: observeList.length,
        },
        { status: 403 }
      );
    }

    // 5. Append and write back (merge to preserve other fields)
    const updatedList = [...observeList, symbol];
    await userRef.set({ observe_list: updatedList }, { merge: true });

    return NextResponse.json({
      status: "synced",
      message: `${symbol} added to DailyStock observe list`,
      observe_list: updatedList,
    });
  } catch (error) {
    console.error("Sync to DailyStock failed:", error);
    return NextResponse.json(
      { error: "SYNC_FAILED", message: "Failed to sync to DailyStock" },
      { status: 500 }
    );
  }
}
