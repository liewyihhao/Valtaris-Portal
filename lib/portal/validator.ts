import { prisma } from "@/lib/db";
import { writeAudit } from "./audit";
import { notify } from "./notify";
import { validateTransition, tierMultiplier, holdExpiry } from "./payout";
import { addBusinessDays } from "./labels";
import {
  VALIDATOR_MIN_TIER,
  VALIDATOR_PASS_THRESHOLD,
  REVIEW_SAMPLE_RATE,
  REVIEW_TASK_PREFIX,
  CORRECTION_WINDOW_HOURS,
  type Tier,
  type PayoutStatus,
  type PayoutReasonCode,
  type ReviewDecision,
  type ReviewRoutedReason,
} from "./constants";

// Priority order for the validator queue (probation + appeal first).
const REASON_PRIORITY: Record<string, number> = { probation: 0, appeal: 1, failed_auto_check: 2, sample: 3, spotcheck: 4 };

/** Active validator track ids for a user (for nav gating + queue scoping). */
export async function getActiveValidatorTrackIds(userId: string): Promise<string[]> {
  const caps = await prisma.validatorCapability.findMany({ where: { userId, status: "active" }, select: { trackId: true } });
  return caps.map((c) => c.trackId);
}

export async function isValidator(userId: string): Promise<boolean> {
  return (await prisma.validatorCapability.count({ where: { userId, status: "active" } })) > 0;
}

/** Pending review assignments in this validator's active tracks (not own work). */
export async function getValidatorQueue(userId: string) {
  const trackIds = await getActiveValidatorTrackIds(userId);
  if (trackIds.length === 0) return [];
  const items = await prisma.reviewAssignment.findMany({
    where: {
      decision: null,
      payout: { taskBatch: { trackId: { in: trackIds } }, userId: { not: userId } },
    },
    include: { payout: { include: { taskBatch: { include: { track: true } }, user: true } } },
    orderBy: { createdAt: "asc" },
  });
  return items.sort((a, b) => (REASON_PRIORITY[a.routedReason] ?? 9) - (REASON_PRIORITY[b.routedReason] ?? 9));
}

const TIER_ORDER: Tier[] = ["T0_trainee", "T1_associate", "T2_skilled", "T3_specialist"];
function tierAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);
}

async function trackNameFor(trackId: string): Promise<string> {
  const t = await prisma.track.findUnique({ where: { id: trackId }, select: { name: true } });
  return t?.name ?? "your track";
}

// ---------------------------------------------------------------------------
// Eligibility: T2+ in the track, account active, no disciplinary flags in 90d.
// ---------------------------------------------------------------------------
export async function validatorEligible(userId: string, trackId: string) {
  const [user, qual, recentClawback, openFraud] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.qualification.findUnique({ where: { userId_trackId: { userId, trackId } } }),
    prisma.payout.findFirst({
      where: { userId, status: "clawed_back", updatedAt: { gt: new Date(Date.now() - 90 * 864e5) } },
    }),
    prisma.reviewFlag.findFirst({ where: { userId, type: "fraud_suspected", status: "open" } }),
  ]);
  const reasons: string[] = [];
  if (!user || user.status !== "active") reasons.push("account_inactive");
  if (!qual || qual.status !== "active" || !tierAtLeast(qual.tier as Tier, VALIDATOR_MIN_TIER)) {
    reasons.push("below_T2_in_track");
  }
  if (recentClawback) reasons.push("recent_clawback");
  if (openFraud) reasons.push("open_fraud_flag");
  return { eligible: reasons.length === 0, reasons, tier: (qual?.tier ?? "T0_trainee") as Tier };
}

// ---------------------------------------------------------------------------
// Calibration-exam scoring — the ONLY writer of ValidatorCapability.
// ---------------------------------------------------------------------------
export async function scoreValidatorCalibration(params: { userId: string; trackId: string; score: number }) {
  const { userId, trackId, score } = params;
  const { eligible } = await validatorEligible(userId, trackId);
  const passed = eligible && score >= VALIDATOR_PASS_THRESHOLD;
  if (!passed) return { passed: false, score };

  const existing = await prisma.validatorCapability.findUnique({ where: { userId_trackId: { userId, trackId } } });
  const cap = await prisma.validatorCapability.upsert({
    where: { userId_trackId: { userId, trackId } },
    create: { userId, trackId, status: "active", calibrationExamScore: score, lastCalibrationCheckAt: new Date() },
    update: { status: "active", calibrationExamScore: score, lastCalibrationCheckAt: new Date() },
  });
  await writeAudit({
    entityType: "ValidatorCapability",
    entityId: cap.id,
    action: existing ? "validator_recertified" : "validator_granted",
    after: { trackId, score, status: "active" },
  });
  const trackName = await trackNameFor(trackId);
  await notify({
    userId,
    category: "validator",
    title: existing ? `Validator access recertified — ${trackName}` : `Validator access granted — ${trackName}`,
    body: existing
      ? `Your validator calibration for ${trackName} is renewed. The review queue is open to you.`
      : `You passed the ${trackName} validator calibration exam. You can now review other annotators' work in the Validate queue.`,
    deepLink: "/validate",
    email: true,
  });
  return { passed: true, score };
}

// ---------------------------------------------------------------------------
// Cross-impacts (integration spec §4).
// ---------------------------------------------------------------------------

/** Tier dropped below T2 → suspend the linked ValidatorCapability. */
export async function syncValidatorWithTier(userId: string, trackId: string, tier: Tier) {
  if (tierAtLeast(tier, VALIDATOR_MIN_TIER)) return;
  const cap = await prisma.validatorCapability.findUnique({ where: { userId_trackId: { userId, trackId } } });
  if (cap && cap.status === "active") {
    await prisma.validatorCapability.update({ where: { id: cap.id }, data: { status: "paused" } });
    await writeAudit({ entityType: "ValidatorCapability", entityId: cap.id, action: "validator_paused_tier_drop", after: { tier } });
    const trackName = await trackNameFor(trackId);
    await notify({
      userId,
      type: "lifecycle",
      category: "validator",
      title: `Validator access paused — ${trackName}`,
      body: `Your ${trackName} tier dropped below T2, so your validator capability there is paused. Requalify at T2+ to restore it.`,
      deepLink: "/profile",
      email: true,
    });
  }
}

/** Confirmed-fraud clawback on own work → pause ALL of this user's capabilities. */
export async function pauseValidatorOnFraud(userId: string) {
  const caps = await prisma.validatorCapability.findMany({ where: { userId, status: "active" } });
  for (const c of caps) {
    await prisma.validatorCapability.update({ where: { id: c.id }, data: { status: "paused" } });
    await writeAudit({ entityType: "ValidatorCapability", entityId: c.id, action: "validator_paused_fraud" });
  }
  if (caps.length > 0) {
    await notify({
      userId,
      type: "lifecycle",
      category: "validator",
      title: "Validator access paused pending review",
      body: `A confirmed-fraud clawback on your own work has paused your validator capabilities while Trust & Safety reviews. This decision is appealable.`,
      deepLink: "/appeals",
      email: true,
    });
  }
  return caps.length;
}

// ---------------------------------------------------------------------------
// Routing: decide whether a pending_qa payout goes to human review.
// ---------------------------------------------------------------------------
export function decideRouting(params: {
  inProbation: boolean;
  autoCheckFailedOrBorderline: boolean;
  underAppeal: boolean;
  sampleRoll?: number; // 0..1; injected for testability
}): { route: boolean; reason?: ReviewRoutedReason } {
  if (params.inProbation) return { route: true, reason: "probation" };
  if (params.autoCheckFailedOrBorderline) return { route: true, reason: "failed_auto_check" };
  if (params.underAppeal) return { route: true, reason: "appeal" };
  const roll = params.sampleRoll ?? Math.random();
  if (roll < REVIEW_SAMPLE_RATE) return { route: true, reason: "sample" };
  return { route: false };
}

/** Route a payout to human review: set status + create a ReviewAssignment. */
export async function routeToHumanReview(payoutId: string, reason: ReviewRoutedReason) {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) return null;
  const check = validateTransition({ from: payout.status as PayoutStatus, to: "pending_human_review" });
  if (!check.ok) return null;
  await prisma.payout.update({
    where: { id: payoutId },
    data: { status: "pending_human_review", holdExpiresAt: holdExpiry() },
  });
  const ra = await prisma.reviewAssignment.create({
    data: { payoutId, routedReason: reason, slaDueAt: addBusinessDays(new Date()) },
  });
  await writeAudit({ entityType: "Payout", entityId: payoutId, action: "routed_to_review", after: { reason } });
  return ra;
}

// ---------------------------------------------------------------------------
// The Validator's decision → advances the reviewed payout + pays the validator.
// ---------------------------------------------------------------------------
export async function recordReviewDecision(params: {
  reviewAssignmentId: string;
  validatorId: string;
  decision: ReviewDecision;
  reasonCode?: PayoutReasonCode | null;
  reasonDetail?: string | null;
}) {
  const ra = await prisma.reviewAssignment.findUnique({
    where: { id: params.reviewAssignmentId },
    include: { payout: { include: { taskBatch: true } } },
  });
  if (!ra) return { ok: false as const, error: "Review not found" };
  if (ra.decision) return { ok: false as const, error: "Already decided" };

  // A Validator never reviews their own submission.
  if (ra.payout.userId === params.validatorId) return { ok: false as const, error: "Cannot review your own work" };

  const trackId = ra.payout.taskBatch.trackId;
  // Must hold an active capability for this track.
  const cap = await prisma.validatorCapability.findUnique({
    where: { userId_trackId: { userId: params.validatorId, trackId } },
  });
  if (!ra.isCalibration && (!cap || cap.status !== "active")) {
    return { ok: false as const, error: "No active validator capability for this track" };
  }

  // Map decision → target payout status.
  const target: Record<ReviewDecision, PayoutStatus> = {
    approve: "approved",
    reject: "rejected",
    correction_requested: "correction_requested",
    escalate: "escalated",
  };
  const to = target[params.decision];
  const check = validateTransition({
    from: ra.payout.status as PayoutStatus,
    to,
    reasonCode: params.reasonCode,
    reasonDetail: params.reasonDetail,
  });
  if (!check.ok) return { ok: false as const, error: check.error };

  await prisma.$transaction([
    prisma.payout.update({
      where: { id: ra.payoutId },
      data: {
        status: to,
        reasonCode: params.reasonCode ?? null,
        reasonDetail: params.reasonDetail ?? null,
        approvedAt: to === "approved" ? new Date() : undefined,
        holdExpiresAt:
          to === "correction_requested" ? new Date(Date.now() + CORRECTION_WINDOW_HOURS * 3600 * 1000) : null,
      },
    }),
    prisma.reviewAssignment.update({
      where: { id: ra.id },
      data: {
        validatorId: params.validatorId,
        decision: params.decision,
        reasonCode: params.reasonCode ?? null,
        reasonDetail: params.reasonDetail ?? null,
        decidedAt: new Date(),
      },
    }),
  ]);

  // Escalation lands in the Ops review queue.
  if (params.decision === "escalate") {
    await prisma.reviewFlag.create({
      data: {
        userId: ra.payout.userId,
        type: "fraud_suspected",
        context: { payoutId: ra.payoutId, escalatedBy: params.validatorId },
        note: "Escalated by validator for ops review.",
      },
    });
  }

  await writeAudit({
    entityType: "Payout",
    entityId: ra.payoutId,
    action: `review_${params.decision}`,
    actorId: params.validatorId,
    after: { decision: params.decision, reasonCode: params.reasonCode ?? null },
  });

  // Tell the annotator when a correction is requested — the actionable event.
  // The window itself is enforced by expireCorrectionWindows() (jobs.ts).
  if (params.decision === "correction_requested") {
    await notify({
      userId: ra.payout.userId,
      category: "review",
      title: "Correction requested on your submission",
      body: `A validator asked for a correction${params.reasonDetail ? `: ${params.reasonDetail}` : ""}. Resubmit within ${CORRECTION_WINDOW_HOURS} hours or the payout is closed (and remains appealable).`,
      deepLink: "/my-work",
      email: true,
    });
  }

  // Pay the Validator for the review (unless it was a calibration gold item).
  if (!ra.isCalibration) {
    await payValidatorForReview(params.validatorId, trackId, ra.payout.taskBatchId ?? undefined);
  }

  return { ok: true as const };
}

/** Create the Validator's review-pay payout (review:<track> rate × their tier). */
async function payValidatorForReview(validatorId: string, trackId: string, reviewedBatchId?: string) {
  const reviewBatch = await prisma.taskBatch.findFirst({
    where: { trackId, taskType: { startsWith: REVIEW_TASK_PREFIX } },
  });
  const batchId = reviewBatch?.id ?? reviewedBatchId;
  if (!batchId) return;
  const rate = await prisma.rateCard.findFirst({
    where: { trackId, taskType: { startsWith: REVIEW_TASK_PREFIX }, isCurrent: true },
    orderBy: { version: "desc" },
  });
  const cap = await prisma.qualification.findUnique({ where: { userId_trackId: { userId: validatorId, trackId } } });
  const tier = (cap?.tier ?? "T2_skilled") as Tier;
  const gross = Math.round((rate?.baseRate ?? 0.15) * tierMultiplier(tier) * 100) / 100;
  await prisma.payout.create({
    data: {
      userId: validatorId,
      taskBatchId: batchId,
      grossAmount: gross,
      currency: "USD",
      rateCardVersion: rate?.version ?? 1,
      tierMultiplier: tierMultiplier(tier),
      status: "approved", // review pay isn't itself re-reviewed
      approvedAt: new Date(),
      itemCount: 1,
    },
  });
}
