import { prisma } from "@/lib/db";
import { writeAudit } from "./audit";
import { validateTransition } from "./payout";
import { SANCTIONS_RESCREEN_DAYS } from "./constants";

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

// Correction-window expiry: a correction_requested payout whose window elapsed
// with no resubmission is closed as rejected (reason-coded + appealable). The
// window is stored in holdExpiresAt when the validator requests the correction.
export async function expireCorrectionWindows() {
  const { notify } = await import("./notify");
  const { t } = await import("./i18n");
  const expired = await prisma.payout.findMany({
    where: { status: "correction_requested", holdExpiresAt: { lt: new Date() } },
  });
  for (const p of expired) {
    const check = validateTransition({
      from: "correction_requested",
      to: "rejected",
      reasonCode: "no_response_after_correction_request",
    });
    if (!check.ok) continue;
    await prisma.payout.update({
      where: { id: p.id },
      data: { status: "rejected", reasonCode: "no_response_after_correction_request", holdExpiresAt: null },
    });
    await writeAudit({
      entityType: "Payout",
      entityId: p.id,
      action: "correction_window_expired",
      before: { status: "correction_requested" },
      after: { status: "rejected", reasonCode: "no_response_after_correction_request" },
    });
    await notify({
      userId: p.userId,
      type: "lifecycle",
      category: "payout",
      title: t("notif.correction.expired.title"),
      body: t("notif.correction.expired.body"),
      deepLink: "/appeals",
      email: true,
    });
  }
  return expired.length;
}

// Sanctions re-screening cadence (master design §2.12). Re-checks the oldest
// batch of trust profiles due for re-screening against the current list. A
// newly-flagged worker is reason-coded into the Trust & Safety queue, has their
// active payout methods frozen, and is notified — every adverse action stays
// appealable. Batched (oldest-first) so a 10k roster never re-screens at once.
export async function reScreenSanctions(limit = 200) {
  const { getScreeningProvider, needsRescreen } = await import("./screening");
  const { notify } = await import("./notify");
  const { t } = await import("./i18n");
  const cutoff = new Date(Date.now() - SANCTIONS_RESCREEN_DAYS * 24 * 3600 * 1000);

  const due = await prisma.trustProfile.findMany({
    where: { OR: [{ sanctionsCheckedAt: null }, { sanctionsCheckedAt: { lt: cutoff } }] },
    include: { user: { select: { id: true, fullName: true, country: true } } },
    orderBy: { sanctionsCheckedAt: { sort: "asc", nulls: "first" } },
    take: limit,
  });

  const provider = getScreeningProvider();
  let rescreened = 0;
  let newlyFlagged = 0;
  for (const tp of due) {
    if (!needsRescreen(tp.sanctionsCheckedAt)) continue;
    const result = await provider.screen({ fullName: tp.user.fullName, country: tp.user.country });
    const wasFlagged = tp.sanctionsStatus === "flagged";
    const nowFlagged = !result.cleared;
    await prisma.trustProfile.update({
      where: { id: tp.id },
      data: { sanctionsStatus: nowFlagged ? "flagged" : "cleared", sanctionsCheckedAt: new Date() },
    });
    rescreened += 1;

    if (nowFlagged && !wasFlagged) {
      newlyFlagged += 1;
      // Freeze active payout methods so no payout dispatches while flagged.
      await prisma.payoutMethod.updateMany({
        where: { userId: tp.userId, isActive: true },
        data: { sanctionsCleared: false },
      });
      await prisma.reviewFlag.create({
        data: {
          userId: tp.userId,
          type: "sanctions_flagged",
          context: { matchDetail: result.matchDetail ?? null, source: "rescreen" },
          note: `Sanctions re-screen match: ${result.matchDetail ?? "flagged"}. Payouts frozen pending Compliance review.`,
        },
      });
      await writeAudit({
        entityType: "TrustProfile",
        entityId: tp.id,
        action: "sanctions_flagged_on_rescreen",
        before: { sanctionsStatus: tp.sanctionsStatus },
        after: { sanctionsStatus: "flagged", matchDetail: result.matchDetail ?? null },
      });
      await notify({
        userId: tp.userId,
        type: "lifecycle",
        category: "compliance",
        title: t("notif.compliance.review.title"),
        body: t("notif.compliance.review.body"),
        deepLink: "/help",
        email: true,
      });
    }
  }
  return { rescreened, newlyFlagged };
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
