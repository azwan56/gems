// ============================================================
// GET  /api/sync-dailystock?symbol=XXX — Preview stock info before syncing
// POST /api/sync-dailystock — Sync a single stock to DailyStock observe_list
// Appends a symbol to the user's observe_list field on the shared
// Firestore `users/{uid}` document (same DB as DailyStock platform).
// Respects DailyStock plan limits: trial=2, paid=5, super=unlimited.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/firebase";
import { resolveStock } from "@/lib/stock-resolver";

// DailyStock observe_list limits per plan type
const OBSERVE_LIMITS: Record<string, number> = {
  trial: 2,
  paid: 5,
  super: Infinity,
};

/**
 * GET /api/sync-dailystock?symbol=GOOGL
 * Returns stock info + current observe_list status for confirmation UI.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  const { uid, planType } = authResult.user;
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "symbol query param is required" },
      { status: 400 }
    );
  }

  try {
    // Resolve stock info from pool/FMP/mock
    const stock = await resolveStock(symbol);

    // Get current observe_list status
    const db = getDb();
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data() || {};
    const observeList: unknown[] = (userData.observe_list as unknown[]) || [];
    const limit = OBSERVE_LIMITS[planType] ?? OBSERVE_LIMITS.trial;

    const alreadyInList = observeList.some((item) => {
      if (typeof item === 'string') return item === symbol;
      return item && typeof item === 'object' && (item as Record<string, unknown>).symbol === symbol;
    });

    return NextResponse.json({
      symbol,
      companyName: stock?.companyName || symbol,
      sector: stock?.sector || "—",
      industry: stock?.industry || "—",
      price: stock?.price ?? null,
      marketCap: stock?.marketCap ?? null,
      alreadyInList,
      observeListCount: observeList.length,
      observeListLimit: limit === Infinity ? null : limit,
      planType,
    });
  } catch (error) {
    console.error("Stock lookup failed:", error);
    return NextResponse.json(
      { error: "LOOKUP_FAILED", message: "Failed to look up stock info" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync-dailystock { symbol: "GOOGL" }
 * Appends a single symbol to the user's DailyStock observe_list.
 */
export async function POST(request: NextRequest) {
  // 1. Verify auth
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  const { uid, planType } = authResult.user;

  // 2. Parse request body
  let symbol: string;
  let role: string | undefined;
  try {
    const body = await request.json();
    symbol = body.symbol?.toUpperCase?.();
    role = body.role;
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

    const observeList: any[] = (userData.observe_list as any[]) || [];

    // Helper to check if symbol exists (handling both string and object formats)
    const existingIndex = observeList.findIndex((item) => {
      if (typeof item === 'string') return item === symbol;
      return item && typeof item === 'object' && item.symbol === symbol;
    });

    // 3. Check if already in observe_list
    if (existingIndex !== -1) {
      // If it exists but we are updating the role, let's update it instead of rejecting
      const existingItem = observeList[existingIndex];
      const existingRole = typeof existingItem === 'object' ? existingItem.role : undefined;
      
      if (role && existingRole !== role) {
        observeList[existingIndex] = { symbol, role };
        await userRef.set({ observe_list: observeList }, { merge: true });
        return NextResponse.json({
          status: "updated",
          message: `${symbol} role updated in DailyStock observe list`,
          observe_list: observeList,
        });
      }

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
    const updatedList = [...observeList, role ? { symbol, role } : symbol];
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
