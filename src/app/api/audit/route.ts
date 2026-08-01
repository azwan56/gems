import { NextResponse } from "next/server";
import { loadAuditMetrics } from "@/lib/audit-metrics-store";

export async function GET() {
  try {
    const data = await loadAuditMetrics();
    
    // If no data is available yet, return a 404 so the client knows to show empty/loading state
    if (!data) {
      return NextResponse.json({ 
        success: false, 
        message: "No audit metrics calculated yet. Please wait for the weekend cron job." 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (err: any) {
    console.error("[GET /api/audit] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
