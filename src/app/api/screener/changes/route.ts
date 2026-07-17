import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/auth-middleware";
import { loadRecentScreenerChanges } from "@/lib/screener-snapshot-store";

/**
 * GET: Return the recent strategy stock addition/removal changes history log.
 */
export async function GET(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    
    const changes = await loadRecentScreenerChanges(limit);
    return NextResponse.json({ changes });
  } catch (err) {
    return NextResponse.json(
      { error: "CHANGES_LOAD_ERROR", message: String(err) },
      { status: 500 }
    );
  }
}
