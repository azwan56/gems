// ============================================================
// GET /api/sector-rotation — Fetch latest 3D RRG & Macro Matrix
// ============================================================

import { NextResponse } from "next/server";
import { getLatestSectorRotation } from "@/lib/sector-rotation-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getLatestSectorRotation();
    if (!data) {
      return NextResponse.json(
        { error: "NO_DATA", message: "No sector rotation data found in cache." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load sector rotation";
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
