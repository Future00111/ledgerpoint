/**
 * AI Accountant Phase 2 — recommendation lifecycle.
 *
 * syncDetections() reconciles fresh detector output with persisted
 * recommendations (upsert by dedupe_key, auto-resolve findings that
 * disappeared). decideRecommendation() records explicit user decisions with
 * an append-only audit trail. The AI never applies accounting changes here.
 */
import { db } from "@workspace/db";
import {
  aiRecommendationsTable,
  aiReviewDecisionsTable,
  workflowActivitiesTable,
  type AIRecommendation,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { runDetectors, type Detection } from "./detectors.js";

const ACTIVITY_ENTITY = "ai_accountant";

async function logActivity(companyId: string, eventType: string, description: string, metadata?: Record<string, unknown>, userId?: string) {
  try {
    await db.insert(workflowActivitiesTable).values({
      company_id: companyId,
      entity_type: ACTIVITY_ENTITY,
      entity_id: null,
      event_type: eventType,
      description,
      event_date: new Date(),
      user_id: userId ?? null,
      metadata: metadata ?? null,
    });
  } catch {
    // Timeline logging is best-effort — never fail the main operation.
  }
}

export interface SyncResult {
  detected: number;
  created: number;
  updated: number;
  resolved: number;
}

/** Run all detectors and reconcile results into the recommendations table. */
export async function syncDetections(companyId: string, userId?: string): Promise<SyncResult> {
  const detections = await runDetectors(companyId);
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  let created = 0, updated = 0, resolved = 0;

  const toValues = (det: Detection) => ({
    domain: det.domain,
    kind: det.kind,
    priority: det.priority,
    title: det.title,
    detail: det.detail,
    recommended_action: det.recommended_action,
    confidence: det.confidence,
    amount: det.amount != null ? det.amount.toFixed(2) : null,
    evidence: det.evidence ?? null,
    related_entity_type: det.related_entity_type ?? null,
    related_entity_id: det.related_entity_id ?? null,
    route: det.route ?? null,
    last_detected_at: now,
  });

  // One transaction; concurrency-safe via the (company_id, dedupe_key)
  // unique index + ON CONFLICT upserts.
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(aiRecommendationsTable)
      .where(eq(aiRecommendationsTable.company_id, companyId));
    const byKey = new Map(existing.map((r) => [r.dedupe_key, r]));

    for (const det of detections) {
      const row = byKey.get(det.dedupe_key);
      // approved / dismissed rows are user decisions — leave them alone.
      if (row && row.status !== "open" && row.status !== "snoozed" && row.status !== "resolved") continue;

      // Expired snoozes reopen; resolved findings that reappear reopen.
      const reopen =
        !row ||
        row.status === "resolved" ||
        (row.status === "snoozed" && (!row.snoozed_until || row.snoozed_until <= todayISO));

      await tx.insert(aiRecommendationsTable)
        .values({
          company_id: companyId,
          dedupe_key: det.dedupe_key,
          status: "open",
          first_detected_at: now,
          ...toValues(det),
        })
        .onConflictDoUpdate({
          target: [aiRecommendationsTable.company_id, aiRecommendationsTable.dedupe_key],
          set: {
            ...toValues(det),
            ...(reopen ? { status: "open", snoozed_until: null } : {}),
            updated_at: now,
          },
        });
      if (row) updated += 1; else created += 1;
    }

    // Open/snoozed findings no longer detected → resolved.
    const currentKeys = new Set(detections.map((d) => d.dedupe_key));
    const stale = existing.filter(
      (r) => (r.status === "open" || r.status === "snoozed") && !currentKeys.has(r.dedupe_key),
    );
    if (stale.length > 0) {
      await tx.update(aiRecommendationsTable)
        .set({ status: "resolved", updated_at: now })
        .where(inArray(aiRecommendationsTable.id, stale.map((r) => r.id)));
      resolved = stale.length;
    }
  });

  await logActivity(
    companyId,
    "detection_run",
    `AI Accountant checked the books: ${detections.length} finding${detections.length === 1 ? "" : "s"} (${created} new, ${resolved} resolved).`,
    { detected: detections.length, created, updated, resolved },
    userId,
  );

  return { detected: detections.length, created, updated, resolved };
}

export type Decision = "approved" | "dismissed" | "snoozed" | "reopened";
const DECISION_STATUS: Record<Decision, string> = {
  approved: "approved",
  dismissed: "dismissed",
  snoozed: "snoozed",
  reopened: "open",
};

/** Record an explicit user decision on a recommendation (no accounting mutations). */
export async function decideRecommendation(
  recommendationId: string,
  decision: Decision,
  userId: string,
  note?: string,
  snoozedUntil?: string,
): Promise<AIRecommendation> {
  const [row] = await db
    .select().from(aiRecommendationsTable)
    .where(eq(aiRecommendationsTable.id, recommendationId)).limit(1);
  if (!row) throw new Error("Recommendation not found");

  const now = new Date();
  // Snoozing without a date defaults to 7 days.
  const defaultSnooze = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

  // Status transition + append-only audit row are atomic: a decision can
  // never change state without its audit entry.
  const updatedRow = await db.transaction(async (tx) => {
    const [u] = await tx.update(aiRecommendationsTable)
      .set({
        status: DECISION_STATUS[decision],
        snoozed_until: decision === "snoozed" ? (snoozedUntil ?? defaultSnooze) : null,
        decided_by: decision === "reopened" ? null : userId,
        decided_at: decision === "reopened" ? null : now,
        updated_at: now,
      })
      .where(eq(aiRecommendationsTable.id, recommendationId))
      .returning();
    if (!u) throw new Error("Recommendation not found");

    await tx.insert(aiReviewDecisionsTable).values({
      company_id: row.company_id,
      recommendation_id: recommendationId,
      decision,
      note: note ?? null,
      user_id: userId,
    });
    return u;
  });

  await logActivity(
    row.company_id,
    `recommendation_${decision}`,
    `Recommendation "${row.title}" was ${decision} by the user.`,
    { recommendation_id: recommendationId, decision },
    userId,
  );

  return updatedRow;
}

/** Open + snoozed recommendations, high priority first, newest first within priority. */
export async function listRecommendations(companyId: string, statuses?: string[]) {
  const conditions = [eq(aiRecommendationsTable.company_id, companyId)];
  if (statuses && statuses.length > 0) {
    conditions.push(inArray(aiRecommendationsTable.status, statuses));
  }
  const rows = await db
    .select().from(aiRecommendationsTable)
    .where(and(...conditions))
    .orderBy(desc(aiRecommendationsTable.last_detected_at));
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return rows.sort((a, b) => (rank[a.priority ?? "low"] ?? 3) - (rank[b.priority ?? "low"] ?? 3));
}

/** Decision history for a company (audit trail). */
export async function listDecisions(companyId: string) {
  return db
    .select().from(aiReviewDecisionsTable)
    .where(eq(aiReviewDecisionsTable.company_id, companyId))
    .orderBy(desc(aiReviewDecisionsTable.created_at))
    .limit(100);
}

/** AI Accountant activity timeline (detection runs + decisions). */
export async function listActivity(companyId: string) {
  return db
    .select().from(workflowActivitiesTable)
    .where(
      and(
        eq(workflowActivitiesTable.company_id, companyId),
        eq(workflowActivitiesTable.entity_type, ACTIVITY_ENTITY),
      ),
    )
    .orderBy(desc(workflowActivitiesTable.event_date))
    .limit(100);
}

/** Dashboard summary of the proactive workspace. */
export async function getWorkspaceSummary(companyId: string) {
  const rows = await db
    .select().from(aiRecommendationsTable)
    .where(eq(aiRecommendationsTable.company_id, companyId));

  const open = rows.filter((r) => r.status === "open");
  const byDomain: Record<string, number> = {};
  for (const r of open) byDomain[r.domain] = (byDomain[r.domain] || 0) + 1;

  const lastRun = rows.reduce<Date | null>((latest, r) => {
    const t = r.last_detected_at ? new Date(r.last_detected_at) : null;
    return t && (!latest || t > latest) ? t : latest;
  }, null);

  return {
    open: open.length,
    high_priority: open.filter((r) => r.priority === "high").length,
    snoozed: rows.filter((r) => r.status === "snoozed").length,
    approved: rows.filter((r) => r.status === "approved").length,
    dismissed: rows.filter((r) => r.status === "dismissed").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    by_domain: byDomain,
    total_amount_at_risk: Math.round(open.reduce((s, r) => s + Number(r.amount || 0), 0) * 100) / 100,
    last_run_at: lastRun ? lastRun.toISOString() : null,
  };
}
