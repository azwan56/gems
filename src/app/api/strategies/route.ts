import { NextRequest, NextResponse } from "next/server";
import { getAllStrategyPresets } from "@/lib/strategies";
import { saveStrategy } from "@/lib/user-store";
import { requirePremium } from "@/lib/auth-middleware";

export async function GET() {
  const presets = getAllStrategyPresets();
  return NextResponse.json({ strategies: presets });
}

export async function POST(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  const userId = authResult.user.uid;

  try {
    const body = await request.json();
    const { name, baseStrategy, filters } = body;

    if (!name || !baseStrategy || !filters) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "name, baseStrategy, and filters are required" },
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
