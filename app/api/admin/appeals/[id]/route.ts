import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/portal/session";
import { writeAudit } from "@/lib/portal/audit";
import { notify } from "@/lib/portal/notify";

const schema = z.object({
  decision: z.enum(["upheld", "denied"]),
  note: z.string().min(3),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A resolution note is required." }, { status: 400 });

  const appeal = await prisma.appeal.findUnique({ where: { id }, include: { payout: true } });
  if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });

  await prisma.appeal.update({
    where: { id },
    data: {
      status: parsed.data.decision,
      resolvedAt: new Date(),
      resolutionNote: parsed.data.note,
      resolvedById: staff.id,
    },
  });

  // Upheld → restore the payout (administrative override of a terminal reject/
  // clawback, recorded in the audit log rather than a normal state transition).
  if (parsed.data.decision === "upheld") {
    await prisma.payout.update({
      where: { id: appeal.payoutId },
      data: { status: "approved", reasonCode: null, reasonDetail: null, holdExpiresAt: null },
    });
    await writeAudit({
      entityType: "Payout",
      entityId: appeal.payoutId,
      action: "restored_by_appeal",
      actorId: staff.id,
      before: { status: appeal.payout.status, reasonCode: appeal.payout.reasonCode },
      after: { status: "approved" },
    });
  }

  await writeAudit({
    entityType: "Appeal",
    entityId: id,
    action: `appeal_${parsed.data.decision}`,
    actorId: staff.id,
    after: { decision: parsed.data.decision },
  });

  // Close the related ops review flag(s).
  await prisma.reviewFlag.updateMany({
    where: { type: "appeal", status: "open", userId: appeal.userId },
    data: { status: "resolved", resolvedAt: new Date(), resolvedById: staff.id },
  });

  // Notify the worker of the outcome, linking to the decision + note in-context.
  const upheld = parsed.data.decision === "upheld";
  await notify({
    userId: appeal.userId,
    category: "appeal",
    title: upheld ? "Your appeal was upheld" : "Your appeal was reviewed",
    body: upheld
      ? `We reviewed your appeal and restored the payout. ${parsed.data.note}`
      : `We reviewed your appeal and the original decision stands. ${parsed.data.note}`,
    deepLink: "/appeals",
    email: true,
  });

  return NextResponse.json({ ok: true });
}
