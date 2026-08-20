import { prisma } from "@/lib/db";
import { computePayout } from "./payout";
import { holdExpiry } from "./payout";
import type { Tier } from "./constants";

// Resolve the Valtaris user + batch + amount for an incoming annotation, then
// create a pending_qa Payout and enqueue a QA-check job. Returns null when it
// can't be mapped (logged by the caller for reconciliation).
export async function ingestAnnotation(params: {
  labelStudioProjectId: string;
  labelStudioTaskId: string;
  labelStudioAnnotationId: string;
  labelStudioUserId?: string | null;
  valtarisUserId?: string | null; // fallback from task meta
  isGold: boolean;
  goldCorrect?: boolean | null;
  itemCount?: number;
}) {
  // Gold/calibration items belong to the qualification pipeline, not payouts.
  if (params.isGold) {
    return { kind: "gold" as const };
  }

  const batch = await prisma.taskBatch.findFirst({
    where: { labelStudioProjectId: params.labelStudioProjectId },
    include: { track: true },
  });
  if (!batch) return null;

  // Identify the annotator.
  let userId = params.valtarisUserId ?? null;
  if (!userId && params.labelStudioUserId) {
    const acct = await prisma.labelStudioAccount.findFirst({
      where: { labelStudioUserId: params.labelStudioUserId },
    });
    userId = acct?.userId ?? null;
  }
  if (!userId) return null;

  const qualification = await prisma.qualification.findUnique({
    where: { userId_trackId: { userId, trackId: batch.trackId } },
  });
  const tier = (qualification?.tier ?? "T1_associate") as Tier;

  const rateCard = await prisma.rateCard.findFirst({
    where: { trackId: batch.trackId, taskType: batch.taskType, isCurrent: true },
    orderBy: { version: "desc" },
  });
  const baseRate = rateCard?.baseRate ?? 0.1;
  const itemCount = params.itemCount ?? 1;

  const grossAmount = computePayout({
    baseRate,
    complexityMultiplier: batch.complexityMultiplier,
    tier,
    itemCount,
  });

  const payout = await prisma.payout.create({
    data: {
      userId,
      taskBatchId: batch.id,
      grossAmount,
      currency: "USD",
      rateCardVersion: rateCard?.version ?? 1,
      tierMultiplier: 1,
      status: "pending_qa",
      holdExpiresAt: holdExpiry(),
      labelStudioTaskId: params.labelStudioTaskId,
      labelStudioAnnotationId: params.labelStudioAnnotationId,
      itemCount,
    },
  });

  await prisma.job.create({
    data: { type: "qa_check", payload: { payoutId: payout.id, goldCorrect: params.goldCorrect ?? null } },
  });

  return { kind: "payout" as const, payoutId: payout.id };
}
