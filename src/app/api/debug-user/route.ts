// ============================================================
// DEBUG ONLY — Inspect user document in Firestore
// Remove this route after debugging is complete
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;
    const email = decoded.email;

    const db = getDb();

    // Check multiple possible collection names
    const collectionsToCheck = ["users", "profiles", "subscribers", "members", "accounts"];
    const results: Record<string, unknown> = { uid, email };

    for (const col of collectionsToCheck) {
      try {
        const doc = await db.collection(col).doc(uid).get();
        if (doc.exists) {
          results[`collection_${col}`] = doc.data();
        }
      } catch {
        // skip
      }
    }

    // Also check if there's a document keyed by email
    for (const col of collectionsToCheck) {
      try {
        const snap = await db.collection(col).where("email", "==", email).limit(1).get();
        if (!snap.empty) {
          results[`collection_${col}_by_email`] = snap.docs[0].data();
          results[`collection_${col}_by_email_docId`] = snap.docs[0].id;
        }
      } catch {
        // skip
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
