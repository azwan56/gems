// ============================================================
// POST /api/stock/chat
// Proxy to the DailyStock backend's /api/stock/chat endpoint.
// Forwards the streaming response to the client.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-middleware";

const DAILYSTOCK_API_URL =
  process.env.DAILYSTOCK_API_URL || "https://daily-mkt-rpt.onrender.com/api";

export async function POST(request: NextRequest) {
  // 1. Verify Authentication
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  try {
    // 2. Parse request body
    const body = await request.json();

    // 3. Retrieve auth token from request header to forward to backend
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Missing Authorization header" },
        { status: 401 }
      );
    }

    // 4. Forward the POST request to the Python backend
    const url = `${DAILYSTOCK_API_URL}/stock/chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`DailyStock /api/stock/chat returned ${res.status}`);
      const errText = await res.text();
      return NextResponse.json(
        { error: "UPSTREAM_ERROR", message: `Backend returned status ${res.status}: ${errText}` },
        { status: res.status }
      );
    }

    // 5. Stream the response body from python backend back to the client
    if (!res.body) {
      return NextResponse.json(
        { error: "NO_STREAM_BODY", message: "No stream body from upstream" },
        { status: 502 }
      );
    }

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (e) {
    console.error("Failed to proxy stock chat:", e);
    return NextResponse.json(
      { error: "PROXY_FAILED", message: `Failed to fetch chat from backend: ${String(e)}` },
      { status: 502 }
    );
  }
}
