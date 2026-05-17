// ============================================================
// GET /api/strategies/saved?userId=xxx — List user's saved strategies
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getSavedStrategies } from "@/lib/user-store";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "MISSING_USER_ID", message: "userId query parameter is required" },
      { status: 400 }
    );
  }

  const strategies = await getSavedStrategies(userId);
  return NextResponse.json({ strategies });
}
