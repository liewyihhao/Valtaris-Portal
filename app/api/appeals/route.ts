import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { isAppealable } from "@/lib/portal/payout";
import { addBusinessDays } from "@/lib/portal/labels";
import { writeAudit } from "@/lib/portal/audit";
import type { PayoutStatus } from "@/lib/portal/constants";

const schema = z.object({
  payoutId: z.string(),
  explanation: z.string().min(10, "Please explain your appeal (at least a sentence)."),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const payout = await prisma.payout.findUnique({ where: { id: parsed.data.payoutId }, include: { appeal: true } });
  if (!payout || payout.userId !== user.id) {
    return NextResponse.json({ error: "Payout not found." }, { status: 404 });
  }
  if (!isAppealable(payout.status as PayoutStatus)) {
    return NextResponse.json({ error: "This payout isn't appealable." }, { status: 400 });
  }
  if (payout.appeal) {
    return NextResponse.json({ error: "An appeal already exists for this payout." }, { status: 409 });
  }

  const appeal = await prisma.appeal.create({
    data: {
      payoutId: payout.id,
      userId: user.id,
      reasonCode: payout.reasonCode,
      explanation: parsed.data.explanation,
      status: "open",
      slaDueAt: addBusinessDays(new Date()),
    },
  });

  await prisma.reviewFlag.create({
    data: {
      userId: user.id,
      type: "appeal",
      context: { appealId: appeal.id, payoutId: payout.id, reasonCode: payout.reasonCode },
      note: "Payout appeal awaiting response.",
    },
  });

  await writeAudit({
    entityType: "Appeal",
    entityId: appeal.id,
    action: "appeal_submitted",
    actorId: user.id,
    after: { payoutId: payout.id, status: "open" },
  });

  return NextResponse.json({ ok: true, id: appeal.id });
}
