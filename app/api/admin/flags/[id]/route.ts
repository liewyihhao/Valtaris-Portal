import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";
import { confirmFraudClawback } from "@/lib/portal/fraud";

const schema = z.object({
  action: z.enum(["resolve", "dismiss", "confirm_fraud"]),
  note: z.string().optional(),
  // confirm_fraud: which payout to claw back (defaults to the flag's context)
  // and the required fraud detail.
  payoutId: z.string().optional(),
  reasonDetail: z.string().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user: staff } = await requireCapability("trust_safety");
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const flag = await prisma.reviewFlag.findUnique({ where: { id } });
  if (!flag) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

  // Confirmed-fraud clawback: reverse the pay + pause validator + revoke Studio,
  // then resolve the flag. Reason-coded and appealable throughout.
  if (parsed.data.action === "confirm_fraud") {
    const ctxPayoutId = (flag.context as { payoutId?: string } | null)?.payoutId;
    const payoutId = parsed.data.payoutId ?? ctxPayoutId;
    if (!payoutId) {
      return NextResponse.json({ error: "No payout to claw back (none in the flag context; pass payoutId)." }, { status: 400 });
    }
    if (!parsed.data.reasonDetail?.trim()) {
      return NextResponse.json({ error: "A fraud detail is required to confirm a clawback." }, { status: 400 });
    }
    const result = await confirmFraudClawback({ payoutId, reasonDetail: parsed.data.reasonDetail, actorId: staff.id });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const resolved = parsed.data.action !== "dismiss";
  await prisma.reviewFlag.update({
    where: { id },
    data: {
      status: resolved ? "resolved" : "dismissed",
      note: parsed.data.note ?? flag.note,
      resolvedAt: new Date(),
      resolvedById: staff.id,
    },
  });

  await writeAudit({
    entityType: "ReviewFlag",
    entityId: id,
    action: parsed.data.action,
    actorId: staff.id,
    after: { status: resolved ? "resolved" : "dismissed" },
  });

  return NextResponse.json({ ok: true });
}
