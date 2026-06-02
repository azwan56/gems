// ============================================================
// POST /api/rebalance-data/seed — Internal: seed a historical snapshot
// Used to backfill prediction data for months before the system went live.
// Protected by CRON_SECRET.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { saveAlertSnapshot } from "@/lib/rebalance-store";
import type { AlertSnapshot } from "@/lib/rebalance-store";

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json() as AlertSnapshot;
    if (!body.date || !body.period || !body.macro) {
      return NextResponse.json({ error: "INVALID_BODY", message: "Missing required fields" }, { status: 400 });
    }

    await saveAlertSnapshot(body);
    return NextResponse.json({ status: "ok", date: body.date });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "SEED_ERROR", message: msg }, { status: 500 });
  }
}
