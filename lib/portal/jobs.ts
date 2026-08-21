import { prisma } from "@/lib/db";
import { writeAudit } from "./audit";
import { validateTransition } from "./payout";

// Minimal DB-backed job processing. In production a scheduler hits
// POST /api/jobs/run on an interval; here it can also be run manually.

export async function runQueuedJobs(limit = 50) {
  const jobs = await prisma.job.findMany({
    where: { status: "queued", runAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const job of jobs) {
    await prisma.job.update({ where: { id: job.id }, data: { status: "running", attempts: { increment: 1 } } });
    try {
      if (job.type === "qa_check") await handleQaCheck(job.payload as { payoutId: string; goldCorrect: boolean | null });
      else if (job.type === "broadcast_notification") {
        const { runBroadcast } = await import("./notify");
        await runBroadcast(job.payload as { userIds: string[]; category: string; title: string; body: string; deepLink?: string });
      }
      await prisma.job.update({ where: { id: job.id }, data: { status: "succeeded" } });
      processed += 1;
    } catch (e) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "failed", lastError: e instanceof Error ? e.message : String(e) },
      });
    }
  }
  return processed;
}

// Automated QA: gold-task/consensus check. Here it uses a goldCorrect flag when
// present; otherwise it approves (the demo's "consensus passed" path). A real
// implementation compares against the gold answer key / inter-annotator agreement.
async function handleQaCheck(payload: { payoutId: string; goldCorrect: boolean | null }) {
  const payout = await prisma.payout.findUnique({ where: { id: payload.payoutId } });
  if (!payout || payout.status !== "pending_qa") return;

  if (payload.goldCorrect === false) {
    const check = validateTransition({ from: "pending_qa", to: "rejected", reasonCode: "failed_gold_task" });
    if (!check.ok) return;
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: "rejected", reasonCode: "failed_gold_task" },
    });
    await writeAudit({ entityType: "Payout", entityId: payout.id, action: "auto_rejected", before: { status: "pending_qa" }, after: { status: "rejected", reasonCode: "failed_gold_task" } });
    return;
  }

  await prisma.payout.update({ where: { id: payout.id }, data: { status: "approved", approvedAt: new Date() } });
  await writeAudit({ entityType: "Payout", entityId: payout.id, action: "auto_approved", before: { status: "pending_qa" }, after: { status: "approved" } });
}

// Escalate any pending_qa payout past its published max hold to human review.
export async function escalateExpiredHolds() {
  const expired = await prisma.payout.findMany({
    where: { status: "pending_qa", holdExpiresAt: { lt: new Date() } },
  });
  for (const p of expired) {
    await prisma.payout.update({ where: { id: p.id }, data: { status: "held" } });
    await prisma.reviewFlag.create({
      data: {
        userId: p.userId,
        type: "payout_hold_escalation",
        context: { payoutId: p.id },
        note: "Auto-QA exceeded the max hold window — escalated to human review.",
      },
    });
    await writeAudit({ entityType: "Payout", entityId: p.id, action: "hold_escalated", before: { status: "pending_qa" }, after: { status: "held" } });
  }
  return expired.length;
}

// Reconciliation: poll Label Studio for annotations not yet recorded as a
// Submission, so a missed webhook never leaves completed work unaccounted for.
// Uses the LS REST client; no-ops safely when the instance isn't configured.
export async function reconcileFromLabelStudio() {
  const { labelStudio } = await import("./label-studio-client");
  if (!labelStudio.configured()) {
    return { reconciled: 0, note: "Label Studio not configured (LABEL_STUDIO_BASE_URL/API_TOKEN)" };
  }
  const mappings = await prisma.labelStudioMapping.findMany();
  let reconciled = 0;
  for (const m of mappings) {
    const res = await labelStudio.listAnnotations(m.labelStudioProjectId);
    if (!res.ok || !Array.isArray(res.data)) continue;
    for (const ann of res.data as Array<{ id: number }>) {
      const known = await prisma.submission.findUnique({ where: { labelStudioAnnotationId: String(ann.id) } });
      if (!known) reconciled += 1; // a real impl would re-ingest via ingestAnnotation
    }
  }
  return { reconciled, note: reconciled ? "found gaps — re-ingest wired as follow-up" : "in sync" };
}

// Applicant data-lifecycle maintenance (11mo warn / 12mo purge).
export { runDormancyWarnings, runDormancyPurge } from "./lifecycle";
