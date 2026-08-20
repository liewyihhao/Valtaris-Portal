import { prisma } from "@/lib/db";

// Recompute a user's PerformanceMetric for a track from their Submissions and
// Payout history. This is the Phase-2 pipeline: the QA loop feeds performance,
// which then powers talent selection.
export async function recomputePerformance(userId: string, trackId: string) {
  const [subs, payouts, appeals] = await Promise.all([
    prisma.submission.findMany({ where: { userId, trackId } }),
    prisma.payout.findMany({ where: { userId, taskBatch: { trackId } }, include: { appeal: true } }),
    prisma.appeal.count({ where: { userId } }),
  ]);

  const gold = subs.filter((s) => s.isGold);
  const goldPass = gold.filter((s) => s.qaResult === "pass").length;
  const goldPassRate = gold.length ? goldPass / gold.length : null;

  const live = subs.filter((s) => !s.isGold);
  const liveApproved = live.filter((s) => s.qaResult === "approved" || s.qaResult === "pass").length;
  const rollingAccuracy = live.length ? liveApproved / live.length : goldPassRate;

  const decided = payouts.filter((p) => ["approved", "paid", "rejected", "clawed_back"].includes(p.status));
  const rejected = payouts.filter((p) => p.status === "rejected" || p.status === "clawed_back").length;
  const rejectionRate = decided.length ? rejected / decided.length : null;
  const appealRate = decided.length ? appeals / decided.length : null;

  await prisma.performanceMetric.upsert({
    where: { userId_trackId: { userId, trackId } },
    create: {
      userId, trackId, goldPassRate, rollingAccuracy, rejectionRate, appealRate,
      windowStart: new Date(Date.now() - 30 * 864e5), windowEnd: new Date(),
    },
    update: {
      goldPassRate, rollingAccuracy, rejectionRate, appealRate, windowEnd: new Date(),
    },
  });
}
