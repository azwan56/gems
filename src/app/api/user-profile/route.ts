// ============================================================
// GET /api/user-profile — Server-side user profile lookup/init
// Runs over same-origin Cloud Run VPC so client browsers never
// hang when firestore.googleapis.com WebChannel is throttled.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureInitialized } from "@/lib/firebase";
import type { PlanType } from "@/lib/auth-middleware";

const PREMIUM_PLANS: PlanType[] = ["paid", "super"];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const idToken = authHeader.slice(7);

  try {
    ensureInitialized();
    const { getAuth } = await import("firebase-admin/auth");
    const { FieldValue } = await import("firebase-admin/firestore");
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = getDb();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (snap.exists) {
      const data = snap.data() || {};
      const planType = (data.plan_type as PlanType) || "trial";
      const planEndDate = data.plan_end_date as string | undefined;
      let isPremium = PREMIUM_PLANS.includes(planType);
      let isExpired = false;
      if (isPremium && planEndDate) {
        if (new Date(planEndDate) < new Date()) {
          isPremium = false;
          isExpired = true;
        }
      }

      return NextResponse.json({
        profile: {
          uid,
          email: decoded.email || data.email || null,
          displayName: decoded.name || data.displayName || null,
          photoURL: decoded.picture || data.photoURL || null,
          planType,
          isPremium,
          planEndDate,
          isExpired,
        },
      });
    }

    // Provision minimal 30-day trial profile for new Gems users without touching watchlist
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const planEndDate = trialEnd.toISOString().split("T")[0];
    await userRef.set(
      {
        email: decoded.email || null,
        plan_type: "trial",
        plan_end_date: planEndDate,
        registered_from: "gems",
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      profile: {
        uid,
        email: decoded.email || null,
        displayName: decoded.name || null,
        photoURL: decoded.picture || null,
        planType: "trial" as PlanType,
        isPremium: false,
        planEndDate,
        isExpired: false,
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code || "UNKNOWN";
    return NextResponse.json({ error: "INVALID_TOKEN", code }, { status: 401 });
  }
}
