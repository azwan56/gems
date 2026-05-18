// ============================================================
// GET  /api/watchlist?userId=xxx — Get user's watchlist
// POST /api/watchlist — Add to watchlist
// DELETE /api/watchlist — Remove from watchlist
// PATCH /api/watchlist — Update portfolio role
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getWatchlist, addToWatchlist, removeFromWatchlist, updateWatchlistRole } from "@/lib/user-store";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "MISSING_USER_ID", message: "userId query parameter is required" },
      { status: 400 }
    );
  }

  const watchlist = await getWatchlist(userId);
  return NextResponse.json({ watchlist });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, symbol, notes, role } = body;

    if (!userId || !symbol) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "userId and symbol are required" },
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
  try {
    const body = await request.json();
    const { userId, symbol } = body;

    if (!userId || !symbol) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "userId and symbol are required" },
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
  try {
    const body = await request.json();
    const { userId, symbol, role } = body;

    if (!userId || !symbol) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "userId and symbol are required" },
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
