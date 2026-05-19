// ============================================================
// GET  /api/watchlist?userId=xxx — Get user's watchlist
// POST /api/watchlist — Add to watchlist
// DELETE /api/watchlist — Remove from watchlist
// PATCH /api/watchlist — Update portfolio role
// All routes require authentication (Firebase ID token).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getWatchlist, addToWatchlist, removeFromWatchlist, updateWatchlistRole } from "@/lib/user-store";
import { verifyAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  // Verify auth
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  const userId = authResult.user.uid;
  const watchlist = await getWatchlist(userId);
  return NextResponse.json({ watchlist });
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const { symbol, notes, role } = body;
    const userId = authResult.user.uid;

    if (!symbol) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "symbol is required" },
        { status: 400 }
      );
    }

    const item = await addToWatchlist(userId, symbol, notes, role);
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const { symbol } = body;
    const userId = authResult.user.uid;

    if (!symbol) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "symbol is required" },
        { status: 400 }
      );
    }

    const removed = await removeFromWatchlist(userId, symbol);
    if (!removed) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `${symbol} not found in watchlist` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const { symbol, role } = body;
    const userId = authResult.user.uid;

    if (!symbol) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "symbol is required" },
        { status: 400 }
      );
    }

    const updated = await updateWatchlistRole(userId, symbol, role);
    if (!updated) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `${symbol} not found in watchlist` },
        { status: 404 }
      );
    }

    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }
}
