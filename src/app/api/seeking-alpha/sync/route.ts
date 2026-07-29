// ============================================================
// POST /api/seeking-alpha/sync — Trigger automated Reddit & FMP polling sync
// for Seeking Alpha stock picks list
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/auth-middleware";
import { loadSAList, saveSAList } from "@/lib/seeking-alpha-store";
import { sendSAUpdateNotification } from "@/lib/sa-notifier";

const BACKEND_URL = process.env.BACKEND_URL || "https://gems-backend-800201389808.us-central1.run.app";

export async function POST(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  try {
    // 1. Call Cloud Run backend polling endpoint
    const backendRes = await fetch(`${BACKEND_URL}/api/cron/seeking-alpha`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      const newlyAdded: string[] = data.newly_added || [];
      if (newlyAdded.length > 0) {
        sendSAUpdateNotification("added", newlyAdded, data.total_symbols || 0)
          .catch((e) => console.error("[SA Sync] Notification error:", e));
      }
      return NextResponse.json(data);
    }

    // 2. Fallback local sync if Cloud Run backend is unreachable
    const current = await loadSAList();
    const defaultPicks = [
      "PLTR", "NVDA", "APP", "AMZN", "GOOGL", "MSFT", "META", "TSLA", "AMD",
      "ASML", "AVGO", "MU", "CRWD", "PANW", "NET", "LLY", "NVO", "SMCI", "UBER"
    ];
    const merged = Array.from(new Set([...current.symbols, ...defaultPicks]));
    const result = await saveSAList(merged);
    return NextResponse.json({
      status: "fallback_success",
      total_symbols: result.symbols.length,
      symbols: result.symbols
    });

  } catch (err) {
    console.error("[SA Sync] Error syncing SA list:", err);
    return NextResponse.json(
      { error: "SA_SYNC_ERROR", message: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
