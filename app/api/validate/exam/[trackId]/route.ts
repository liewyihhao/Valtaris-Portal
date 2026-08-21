import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/portal/session";
import { validatorEligible, scoreValidatorCalibration } from "@/lib/portal/validator";
import { scoreValidatorExam } from "@/lib/portal/validator-exam";

const schema = z.object({
  answers: z.array(z.object({ id: z.string(), verdict: z.enum(["approve", "reject"]) })),
});

export async function POST(req: Request, ctx: { params: Promise<{ trackId: string }> }) {
  const user = await requireUser();
  const { trackId } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { eligible, reasons } = await validatorEligible(user.id, trackId);
  if (!eligible) return NextResponse.json({ error: `Not eligible: ${reasons.join(", ")}` }, { status: 403 });

  const score = scoreValidatorExam(parsed.data.answers);
  const result = await scoreValidatorCalibration({ userId: user.id, trackId, score });
  return NextResponse.json({ score, passed: result.passed });
}
