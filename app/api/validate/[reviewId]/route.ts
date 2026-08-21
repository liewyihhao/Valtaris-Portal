import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/portal/session";
import { recordReviewDecision } from "@/lib/portal/validator";

const schema = z.object({
  decision: z.enum(["approve", "reject", "correction_requested", "escalate"]),
  reasonCode: z.enum([
    "failed_gold_task",
    "below_consensus_threshold",
    "guideline_violation",
    "confirmed_fraud",
    "no_response_after_correction_request",
  ]).nullable().optional(),
  reasonDetail: z.string().nullable().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ reviewId: string }> }) {
  const user = await requireUser();
  const { reviewId } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const result = await recordReviewDecision({
    reviewAssignmentId: reviewId,
    validatorId: user.id,
    decision: parsed.data.decision,
    reasonCode: parsed.data.reasonCode ?? null,
    reasonDetail: parsed.data.reasonDetail ?? null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
