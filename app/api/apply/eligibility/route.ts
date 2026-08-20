import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { evaluateEligibility } from "@/lib/portal/eligibility";
import { furthestStage } from "@/lib/portal/funnel";

const schema = z.object({
  ageConfirmed: z.boolean(),
  region: z.string().min(1),
  deviceType: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const result = evaluateEligibility(parsed.data);

  await prisma.eligibilityCheck.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ageConfirmed: parsed.data.ageConfirmed,
      region: parsed.data.region,
      regionEligible: result.passed,
      deviceType: parsed.data.deviceType,
      passed: result.passed,
      reason: result.reason,
    },
    update: {
      ageConfirmed: parsed.data.ageConfirmed,
      region: parsed.data.region,
      regionEligible: result.passed,
      deviceType: parsed.data.deviceType,
      passed: result.passed,
      reason: result.reason,
    },
  });

  if (result.passed) {
    await prisma.user.update({
      where: { id: user.id },
      data: { applicationStage: furthestStage(user.applicationStage, "questionnaire") },
    });
  }

  return NextResponse.json({ passed: result.passed, reason: result.reason });
}
