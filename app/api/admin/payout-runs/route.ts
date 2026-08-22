import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";

// Create a draft payout run that sweeps all approved payouts not yet in a run.
export async function POST() {
  const { user: staff } = await requireCapability("finance_ops");

  const candidates = await prisma.payout.findMany({ where: { status: "approved", payoutRunId: null } });
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No approved payouts to sweep into a run." }, { status: 400 });
  }
  const total = candidates.reduce((s, p) => s + p.grossAmount, 0);
  const now = new Date();

  const run = await prisma.payoutRun.create({
    data: {
      periodStart: new Date(now.getTime() - 7 * 24 * 3600 * 1000),
      periodEnd: now,
      status: "draft",
      cadence: "weekly",
      totalAmount: Math.round(total * 100) / 100,
      payoutCount: candidates.length,
    },
  });
  await prisma.payout.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { payoutRunId: run.id },
  });

  await writeAudit({ entityType: "PayoutRun", entityId: run.id, action: "run_created", actorId: staff.id, after: { total: run.totalAmount, count: run.payoutCount } });
  return NextResponse.json({ ok: true, id: run.id });
}
