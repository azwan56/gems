import { NextRequest, NextResponse } from "next/server";
import { getSavedStrategies } from "@/lib/user-store";
import { requirePremium } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  const userId = authResult.user.uid;
  const strategies = await getSavedStrategies(userId);
  return NextResponse.json({ strategies });
}
