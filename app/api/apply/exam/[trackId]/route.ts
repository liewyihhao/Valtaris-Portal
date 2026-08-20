import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { computeCalibrationScore } from "@/lib/portal/questionnaire";
import { scoreQualificationAttempt } from "@/lib/portal/qualification";
import { furthestStage } from "@/lib/portal/funnel";
import type { TestTrack } from "@/lib/portal/constants";

const schema = z.object({
  answers: z.array(z.object({ questionId: z.string(), selectedIndex: z.number().int().optional() })),
});

export async function POST(req: Request, ctx: { params: Promise<{ trackId: string }> }) {
  const user = await requireUser();
  const { trackId } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  // Cooldown gate: block retries until any prior failed attempt's cooldown ends.
  const lastFailed = await prisma.qualificationTestAttempt.findFirst({
    where: { userId: user.id, trackId, passed: false },
    orderBy: { startedAt: "desc" },
  });
  if (lastFailed?.cooldownUntil && lastFailed.cooldownUntil > new Date()) {
    return NextResponse.json(
      { error: "cooldown", cooldownUntil: lastFailed.cooldownUntil },
      { status: 429 }
    );
  }

  // Grade against DB keys.
  const ids = parsed.data.answers.map((a) => a.questionId);
  const dbq = await prisma.calibrationQuestion.findMany({
    where: { id: { in: ids } },
    select: { id: true, correctIndex: true },
  });
  const keys = dbq.map((q) => ({ questionId: q.id, correctIndex: q.correctIndex }));
  const score = computeCalibrationScore(parsed.data.answers, keys);

  // Which test difficulty was this applicant routed to for this domain?
  const questionnaire = await prisma.questionnaireResponse.findUnique({ where: { userId: user.id } });
  const routed = (questionnaire?.routedTracks as Record<string, string> | undefined)?.[track.domain];
  const testTrack = (routed ?? "foundational") as TestTrack;

  const { tier, passed } = await scoreQualificationAttempt({
    userId: user.id,
    trackId,
    testTrack,
    score,
  });

  if (passed) {
    await prisma.user.update({
      where: { id: user.id },
      data: { applicationStage: furthestStage(user.applicationStage, "guidelines") },
    });
  }

  return NextResponse.json({ score, passed, tier });
}
