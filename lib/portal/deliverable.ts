import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// PROJECT DELIVERABLE (final review → client submission).
// Aggregates a project's accepted (validated + paid-eligible) output for the
// admin's final review and the client-submission export. Draws only on the
// payout ledger (the authoritative record of accepted work), so it can't drift
// from what workers were actually paid for.
// ---------------------------------------------------------------------------

const ACCEPTED = ["approved", "paid"];
const REJECTED = ["rejected", "clawed_back"];

export type Deliverable = {
  project: {
    id: string;
    taskType: string;
    clientName: string;
    track: string;
    estimatedItems: number;
    deliveryStatus: string;
    deliveredAt: string | null;
    labelStudioProjectId: string | null;
  };
  totals: {
    acceptedTasks: number;
    acceptedUnits: number;
    rejectedTasks: number;
    pendingTasks: number;
    validatedReviews: number;
    completionPct: number; // acceptedUnits / estimatedItems
  };
  byWorker: { userId: string; name: string; tasks: number; units: number; gross: number }[];
  generatedAt: string;
};

export async function getProjectDeliverable(batchId: string): Promise<Deliverable | null> {
  const batch = await prisma.taskBatch.findUnique({ where: { id: batchId }, include: { track: true } });
  if (!batch) return null;

  const payouts = await prisma.payout.findMany({
    where: { taskBatchId: batchId },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });
  const reviews = await prisma.reviewAssignment.count({
    where: { payout: { taskBatchId: batchId }, decision: { not: null } },
  });

  const accepted = payouts.filter((p) => ACCEPTED.includes(p.status));
  const rejected = payouts.filter((p) => REJECTED.includes(p.status));
  const pending = payouts.filter((p) => !ACCEPTED.includes(p.status) && !REJECTED.includes(p.status));

  const acceptedUnits = accepted.reduce((s, p) => s + (p.itemCount ?? 0), 0);

  const byWorkerMap = new Map<string, { userId: string; name: string; tasks: number; units: number; gross: number }>();
  for (const p of accepted) {
    const key = p.userId;
    const row = byWorkerMap.get(key) ?? { userId: key, name: p.user.fullName ?? p.user.email, tasks: 0, units: 0, gross: 0 };
    row.tasks += 1;
    row.units += p.itemCount ?? 0;
    row.gross += p.grossAmount;
    byWorkerMap.set(key, row);
  }

  return {
    project: {
      id: batch.id,
      taskType: batch.taskType,
      clientName: batch.clientName,
      track: batch.track.name,
      estimatedItems: batch.estimatedItems,
      deliveryStatus: batch.deliveryStatus,
      deliveredAt: batch.deliveredAt ? batch.deliveredAt.toISOString() : null,
      labelStudioProjectId: batch.labelStudioProjectId,
    },
    totals: {
      acceptedTasks: accepted.length,
      acceptedUnits,
      rejectedTasks: rejected.length,
      pendingTasks: pending.length,
      validatedReviews: reviews,
      completionPct: batch.estimatedItems > 0 ? Math.min(100, Math.round((acceptedUnits / batch.estimatedItems) * 100)) : 0,
    },
    byWorker: [...byWorkerMap.values()].sort((a, b) => b.units - a.units),
    generatedAt: new Date().toISOString(),
  };
}
