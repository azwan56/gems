// ============================================================
// Audit Metrics Store — persists strategy performance and win rates
// ============================================================

import { getDb } from "./firebase";
import { StrategyWinRate, SelfHealingLog, PerformanceShowcaseStock } from "./audit-store";

const COLLECTION = "audit_metrics";
const DOC_ID = "latest";

export interface AuditMetricsData {
  updatedAt: string;
  winRates: StrategyWinRate[];
  showcase: PerformanceShowcaseStock[];
  selfHealingLogs: SelfHealingLog[];
}

/**
 * Save the calculated audit metrics to Firestore.
 */
export async function saveAuditMetrics(data: Omit<AuditMetricsData, "updatedAt">): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(DOC_ID).set({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Load the latest audit metrics from Firestore.
 */
export async function loadAuditMetrics(): Promise<AuditMetricsData | null> {
  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
    if (!doc.exists) return null;
    return doc.data() as AuditMetricsData;
  } catch (e) {
    console.error("Failed to load audit metrics:", e);
    return null;
  }
}
