import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { canRequestPayout } from "@/lib/portal/payout";
import { getPayoutRail } from "@/lib/portal/payout-provider";
import { writeAudit } from "@/lib/portal/audit";
import { notify } from "@/lib/portal/notify";
import type { PayoutProvider } from "@/lib/portal/constants";

export async function POST() {
  const user = await requireUser();

  // Payout method must exist, be verified, active, and sanctions-cleared.
  const method = await prisma.payoutMethod.findFirst({
    where: { userId: user.id, isActive: true, verifiedAt: { not: null }, sanctionsCleared: true },
  });
  if (!method) {
    return NextResponse.json(
      { error: "Add and verify a payout method (with tax paperwork complete) before requesting a payout." },
      { status: 400 }
    );
  }
  if (method.reverifyingUntil && method.reverifyingUntil > new Date()) {
    return NextResponse.json({ error: "Your payout method is being re-verified. Try again shortly." }, { status: 400 });
  }

  const approved = await prisma.payout.findMany({ where: { userId: user.id, status: "approved" } });
  const balance = approved.reduce((s, p) => s + p.grossAmount, 0);

  if (!canRequestPayout({ availableBalance: balance, accountClosing: false })) {
    return NextResponse.json({ error: "Balance is below the $20 minimum payout threshold." }, { status: 400 });
  }

  const rail = getPayoutRail(method.provider as PayoutProvider);
  const now = new Date();

  for (const p of approved) {
    const { paymentId } = await rail.send({
      amount: p.grossAmount,
      currency: p.currency,
      accountRef: method.accountRef,
    });
    await prisma.payout.update({ where: { id: p.id }, data: { status: "paid", paidAt: now } });
    await writeAudit({
      entityType: "Payout",
      entityId: p.id,
      action: "paid",
      actorId: user.id,
      before: { status: "approved" },
      after: { status: "paid", paymentId },
    });
  }

  const paidAmount = Math.round(balance * 100) / 100;
  if (approved.length > 0) {
    await notify({
      userId: user.id,
      category: "payout",
      title: `Payment sent — $${paidAmount.toFixed(2)}`,
      body: `Your payout of $${paidAmount.toFixed(2)} ${method.currency} was dispatched via ${method.provider}. Settlement time depends on your provider.`,
      deepLink: "/earnings",
      email: true,
    });
  }

  return NextResponse.json({ ok: true, paid: approved.length, amount: paidAmount });
}
