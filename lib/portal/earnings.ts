import { prisma } from "@/lib/db";

// Aggregate a user's payout ledger into the numbers the earnings screens show.
export async function getEarningsSummary(userId: string) {
  const payouts = await prisma.payout.findMany({
    where: { userId },
    include: { taskBatch: { include: { track: true } }, appeal: true },
    orderBy: { createdAt: "desc" },
  });

  let available = 0; // approved but not yet paid
  let pending = 0; // pending_qa + held
  let paidTotal = 0;
  let paidThisWeek = 0;

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  for (const p of payouts) {
    if (p.status === "approved") available += p.grossAmount;
    if (p.status === "pending_qa" || p.status === "held") pending += p.grossAmount;
    if (p.status === "paid") {
      paidTotal += p.grossAmount;
      if (p.paidAt && p.paidAt >= weekAgo) paidThisWeek += p.grossAmount;
    }
  }

  return {
    payouts,
    available: round(available),
    pending: round(pending),
    paidTotal: round(paidTotal),
    paidThisWeek: round(paidThisWeek),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
