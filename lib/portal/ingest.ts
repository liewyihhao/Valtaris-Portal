import { prisma } from "@/lib/db";
import { computePayout, holdExpiry } from "./payout";
import { tierForScore, isPassing } from "./qualification";
import { resultMatches } from "./scoring";
import { recomputePerformance } from "./performance";
import { writeAudit } from "./audit";
import type { Tier, TestTrack } from "./constants";

// Ingest one Label Studio annotation. Gold is identified by a ground_truth
// answer key (Section 9), scoring is computed here (Section 5). Qualification
// (exam) projects → QualificationTestAttempt; live projects → Payout. Every
// annotation is recorded as a Submission and feeds PerformanceMetric.
export async function ingestAnnotation(params: {
  labelStudioProjectId: string;
  labelStudioTaskId: string;
  labelStudioAnnotationId: string;
  labelStudioUserId?: string | null;
  valtarisUserId?: string | null;
  isGold: boolean;
  isQualification?: boolean;
  submittedResult?: unknown;
  groundTruthResult?: unknown; // answer key for gold tasks
  itemCount?: number;
}) {
  // Resolve the annotator.
  let userId = params.valtarisUserId ?? null;
  if (!userId && params.labelStudioUserId) {
    const acct = await prisma.labelStudioAccount.findFirst({ where: { labelStudioUserId: params.labelStudioUserId } });
    userId = acct?.userId ?? null;
  }
  if (!userId) return null;

  // Resolve the track: qualification projects map via LabelStudioMapping; live
  // work maps via the TaskBatch.
  const mapping = await prisma.labelStudioMapping.findFirst({ where: { labelStudioProjectId: params.labelStudioProjectId } });
  const batch = await prisma.taskBatch.findFirst({ where: { labelStudioProjectId: params.labelStudioProjectId }, include: { track: true } });
  const isQualification = params.isQualification ?? mapping?.isQualificationProject ?? false;
  const trackId = batch?.trackId ?? mapping?.trackId;
  if (!trackId) return null;

  // Score gold submissions against the answer key.
  let qaResult = "pending";
  if (params.isGold && params.groundTruthResult != null) {
    qaResult = resultMatches(params.submittedResult, params.groundTruthResult) ? "pass" : "fail";
  }

  // Record the submission (idempotent on the LS annotation id).
  await prisma.submission.upsert({
    where: { labelStudioAnnotationId: params.labelStudioAnnotationId },
    create: {
      userId, trackId, taskBatchId: batch?.id ?? null,
      labelStudioProjectId: params.labelStudioProjectId,
      labelStudioTaskId: params.labelStudioTaskId,
      labelStudioAnnotationId: params.labelStudioAnnotationId,
      isGold: params.isGold, isQualification, qaResult,
      submittedResult: (params.submittedResult ?? undefined) as object | undefined,
    },
    update: { qaResult, submittedResult: (params.submittedResult ?? undefined) as object | undefined },
  });

  if (isQualification) {
    const result = await scoreExam(userId, trackId, params.labelStudioProjectId);
    await recomputePerformance(userId, trackId);
    return { kind: "exam" as const, ...result };
  }

  // --- Live work → payout -------------------------------------------------
  if (!batch) return { kind: "submission" as const };
  const qualification = await prisma.qualification.findUnique({ where: { userId_trackId: { userId, trackId } } });
  const tier = (qualification?.tier ?? "T1_associate") as Tier;
  const rateCard = await prisma.rateCard.findFirst({ where: { trackId, taskType: batch.taskType, isCurrent: true }, orderBy: { version: "desc" } });
  const itemCount = params.itemCount ?? 1;
  const grossAmount = computePayout({ baseRate: rateCard?.baseRate ?? 0.1, complexityMultiplier: batch.complexityMultiplier, tier, itemCount });

  const payout = await prisma.payout.create({
    data: {
      userId, taskBatchId: batch.id, grossAmount, currency: "USD",
      rateCardVersion: rateCard?.version ?? 1, tierMultiplier: 1, status: "pending_qa",
      holdExpiresAt: holdExpiry(),
      labelStudioTaskId: params.labelStudioTaskId, labelStudioAnnotationId: params.labelStudioAnnotationId, itemCount,
    },
  });
  // A gold task mixed into live work gives the QA job a definitive answer.
  const goldCorrect = params.isGold ? qaResult === "pass" : null;
  await prisma.job.create({ data: { type: "qa_check", payload: { payoutId: payout.id, goldCorrect } } });
  await recomputePerformance(userId, trackId);
  return { kind: "payout" as const, payoutId: payout.id };
}

// Aggregate a user's gold submissions in an exam project into a running score,
// and update/create their QualificationTestAttempt. Sets the verified tier on
// pass (the exam is the ONLY thing that sets tier).
async function scoreExam(userId: string, trackId: string, projectId: string) {
  const gold = await prisma.submission.findMany({
    where: { userId, trackId, labelStudioProjectId: projectId, isGold: true },
  });
  const answered = gold.length;
  const passed = gold.filter((s) => s.qaResult === "pass").length;
  const score = answered ? Math.round((passed / answered) * 100) : 0;

  // Which difficulty was this applicant routed to?
  const questionnaire = await prisma.questionnaireResponse.findUnique({ where: { userId } });
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  const routed = track ? (questionnaire?.routedTracks as Record<string, string> | undefined)?.[track.domain] : undefined;
  const testTrack = (routed ?? "foundational") as TestTrack;

  // Only decide pass once at least the minimum gold items are answered.
  const MIN_ITEMS = 3;
  const decided = answered >= MIN_ITEMS;
  const tier = decided ? tierForScore(testTrack, score) : "T0_trainee";
  const didPass = decided && isPassing(tier);

  // Upsert the latest attempt for this user+track+project.
  const existing = await prisma.qualificationTestAttempt.findFirst({
    where: { userId, trackId, labelStudioProjectId: projectId },
    orderBy: { startedAt: "desc" },
  });
  const attempt = existing
    ? await prisma.qualificationTestAttempt.update({ where: { id: existing.id }, data: { score, passed: decided ? didPass : null, testTrack, attemptedAt: decided ? new Date() : null } })
    : await prisma.qualificationTestAttempt.create({ data: { userId, trackId, testTrack, score, passed: decided ? didPass : null, labelStudioProjectId: projectId, attemptedAt: decided ? new Date() : null } });

  if (didPass) {
    const before = await prisma.qualification.findUnique({ where: { userId_trackId: { userId, trackId } } });
    await prisma.qualification.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: { userId, trackId, tier, status: "active", verifiedAt: new Date(), sourceAttemptId: attempt.id, recertDueAt: new Date(Date.now() + 180 * 864e5) },
      update: { tier, status: "active", verifiedAt: new Date(), sourceAttemptId: attempt.id },
    });
    await writeAudit({ entityType: "Qualification", entityId: `${userId}:${trackId}`, action: before ? "tier_updated_via_ls_exam" : "tier_set_via_ls_exam", after: { tier, score, sourceAttemptId: attempt.id } });
  }

  return { score, passed: didPass, tier, answered };
}
