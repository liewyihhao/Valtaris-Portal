import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOps } from "@/lib/portal/session";
import { getPayoutRail } from "@/lib/portal/payout-provider";
import { writeAudit } from "@/lib/portal/audit";
import { notify } from "@/lib/portal/notify";
import type { PayoutProvider } from "@/lib/portal/constants";

const schema = z.object({ action: z.enum(["approve", "execute", "cancel"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requireOps();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const run = await prisma.payoutRun.findUnique({ where: { id }, include: { payouts: true } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  if (parsed.data.action === "approve") {
    if (run.status !== "draft") return NextResponse.json({ error: "Only a draft run can be approved." }, { status: 400 });
    await prisma.payoutRun.update({ where: { id }, data: { status: "approved", approvedById: staff.id, approvedAt: new Date() } });
    await writeAudit({ entityType: "PayoutRun", entityId: id, action: "run_approved", actorId: staff.id });
  } else if (parsed.data.action === "cancel") {
    // Release the payouts back to approved so they can go in a later run.
    await prisma.payout.updateMany({ where: { payoutRunId: id }, data: { payoutRunId: null } });
    await prisma.payoutRun.update({ where: { id }, data: { status: "failed" } });
    await writeAudit({ entityType: "PayoutRun", entityId: id, action: "run_cancelled", actorId: staff.id });
  } else if (parsed.data.action === "execute") {
    if (run.status !== "approved") return NextResponse.json({ error: "Approve the run before executing." }, { status: 400 });
    await prisma.payoutRun.update({ where: { id }, data: { status: "executing" } });
    const now = new Date();
    const paidByUser = new Map<string, number>();
    for (const p of run.payouts) {
      if (p.status !== "approved") continue;
      const method = await prisma.payoutMethod.findFirst({ where: { userId: p.userId, isActive: true, verifiedAt: { not: null } } });
      if (!method) continue; // skip; stays in run for follow-up
      const rail = getPayoutRail(method.provider as PayoutProvider);
      const { paymentId } = await rail.send({ amount: p.grossAmount, currency: p.currency, accountRef: method.accountRef });
      await prisma.payout.update({ where: { id: p.id }, data: { status: "paid", paidAt: now } });
      await writeAudit({ entityType: "Payout", entityId: p.id, action: "paid_via_run", actorId: staff.id, before: { status: "approved" }, after: { status: "paid", runId: id, paymentId } });
      paidByUser.set(p.userId, (paidByUser.get(p.userId) ?? 0) + p.grossAmount);
    }
    await prisma.payoutRun.update({ where: { id }, data: { status: "completed", executedAt: now } });
    // One aggregated "payment sent" notice per worker, not one per line item.
    for (const [userId, amount] of paidByUser) {
      const total = Math.round(amount * 100) / 100;
      await notify({
        userId,
        category: "payout",
        title: `Payment sent — $${total.toFixed(2)}`,
        body: `Your payout of $${total.toFixed(2)} was dispatched in this payout run. Settlement time depends on your provider.`,
        deepLink: "/earnings",
        email: true,
      });
    }
    await writeAudit({ entityType: "PayoutRun", entityId: id, action: "run_executed", actorId: staff.id });
  }

  return NextResponse.json({ ok: true });
}
