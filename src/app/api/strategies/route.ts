// ============================================================
// GET /api/strategies — List all available strategy presets
// POST /api/strategies — Save a custom strategy (user-specific)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAllStrategyPresets } from "@/lib/strategies";
import { saveStrategy } from "@/lib/user-store";

export async function GET() {
  const presets = getAllStrategyPresets();
  return NextResponse.json({ strategies: presets });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, baseStrategy, filters } = body;

    if (!userId || !name || !baseStrategy || !filters) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "userId, name, baseStrategy, and filters are required" },
        { status: 400 }
      );
    }

    const saved = await saveStrategy(userId, { name, baseStrategy, filters });
    return NextResponse.json({ strategy: saved }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }
}
