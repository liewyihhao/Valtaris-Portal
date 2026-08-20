import { prisma } from "@/lib/db";
import { PENDING_QA_MAX_HOLD_HOURS } from "./constants";

// Aggregate the payout ledger into the admin monitoring numbers.
export async function getPayoutOverview() {
  const payouts = await prisma.payout.findMany({
    include: { user: true, taskBatch: { include: { track: true } }, appeal: true },
    orderBy: { createdAt: "desc" },
  });

  const totals = {
    pending_qa: 0,
    held: 0,
    approved: 0,
    paidThisPeriod: 0,
    rejected: 0,
    clawed_back: 0,
  };
  const now = Date.now();
  const periodAgo = now - 7 * 24 * 3600 * 1000;

  for (const p of payouts) {
    if (p.status === "pending_qa") totals.pending_qa += p.grossAmount;
    else if (p.status === "held") totals.held += p.grossAmount;
    else if (p.status === "approved") totals.approved += p.grossAmount;
    else if (p.status === "rejected") totals.rejected += p.grossAmount;
    else if (p.status === "clawed_back") totals.clawed_back += p.grossAmount;
    else if (p.status === "paid" && p.paidAt && p.paidAt.getTime() >= periodAgo) totals.paidThisPeriod += p.grossAmount;
  }

  // Exceptions: holds past the published SLA, and rejections with open appeals.
  const exceptions = payouts.filter((p) => {
    const holdBreached =
      (p.status === "pending_qa" || p.status === "held") &&
      p.holdExpiresAt !== null &&
      p.holdExpiresAt.getTime() < now;
    const openAppeal = p.appeal && (p.appeal.status === "open" || p.appeal.status === "under_review");
    return holdBreached || openAppeal;
  });

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    payouts,
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round(v)])) as typeof totals,
    exceptions,
    maxHoldHours: PENDING_QA_MAX_HOLD_HOURS,
  };
}

// Approved payouts not yet swept into a run = the next run's candidates.
export async function getNextRunCandidates() {
  const approved = await prisma.payout.findMany({
    where: { status: "approved", payoutRunId: null },
    include: { user: true },
  });
  const total = approved.reduce((s, p) => s + p.grossAmount, 0);
  return { approved, total: Math.round(total * 100) / 100, count: approved.length };
}
