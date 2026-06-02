// ============================================================
// API: /api/rebalance-data — Serve dashboard data
// Premium-only (paid/super). Returns latest alert snapshots.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withPremium } from "@/lib/api-utils";
import { getLatestSnapshots } from "@/lib/rebalance-store";

export const GET = withPremium(async (request: NextRequest) => {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "10", 10) || 10, 1), 30);

  const snapshots = await getLatestSnapshots(limit);

  return NextResponse.json({
    snapshots,
    count: snapshots.length,
  });
});
