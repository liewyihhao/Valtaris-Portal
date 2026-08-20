import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { furthestStage } from "@/lib/portal/funnel";
import {
  computeCalibrationScore,
  routeTestTrack,
  isSelfReportMismatch,
  type CalibrationAnswer,
} from "@/lib/portal/questionnaire";
import type { SelfRating } from "@/lib/portal/constants";

const answerSchema = z.object({
  questionId: z.string(),
  selectedIndex: z.number().int().optional(),
  freeText: z.string().optional(),
});

const schema = z.object({
  languages: z.array(z.object({ code: z.string(), proficiency: z.string(), primary: z.boolean() })),
  domains: z.array(z.string()).min(1),
  selfRatings: z.record(z.string(), z.string()),
  calibrationAnswers: z.record(z.string(), z.array(answerSchema)),
  technical: z.record(z.string(), z.unknown()).optional(),
  availability: z.record(z.string(), z.unknown()).optional(),
  priorPlatforms: z.string().optional(),
  certifications: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  // Grade server-side using the correct answers from the DB — never trust the
  // client for the answer key.
  const allQuestionIds = Object.values(input.calibrationAnswers).flat().map((a) => a.questionId);
  const dbQuestions = await prisma.calibrationQuestion.findMany({
    where: { id: { in: allQuestionIds } },
    select: { id: true, correctIndex: true },
  });
  const keyById = new Map(dbQuestions.map((q) => [q.id, q.correctIndex]));

  const calibrationScores: Record<string, number> = {};
  const routedTracks: Record<string, string> = {};
  const mismatches: string[] = [];

  for (const domain of input.domains) {
    const answers = (input.calibrationAnswers[domain] ?? []) as CalibrationAnswer[];
    const keys = answers.map((a) => ({
      questionId: a.questionId,
      correctIndex: keyById.get(a.questionId) ?? null,
    }));
    const score = computeCalibrationScore(answers, keys);
    calibrationScores[domain] = score;
    routedTracks[domain] = routeTestTrack(score);

    const selfRating = (input.selfRatings[domain] ?? "None") as SelfRating;
    if (isSelfReportMismatch(selfRating, score)) mismatches.push(domain);
  }

  const mismatchFlag = mismatches.length > 0;
  const mismatchReason = mismatchFlag ? `self-report/calibration mismatch: ${mismatches.join(", ")}` : null;

  const answersJson = {
    languages: input.languages,
    domains: input.domains,
    technical: input.technical ?? {},
    availability: input.availability ?? {},
    priorPlatforms: input.priorPlatforms ?? "",
    certifications: input.certifications ?? "",
  } as Prisma.InputJsonValue;

  await prisma.questionnaireResponse.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      answers: answersJson,
      calibrationScores,
      selfRatings: input.selfRatings,
      routedTracks,
      mismatchFlag,
      mismatchReason,
      completedAt: new Date(),
    },
    update: {
      answers: answersJson,
      calibrationScores,
      selfRatings: input.selfRatings,
      routedTracks,
      mismatchFlag,
      mismatchReason,
      completedAt: new Date(),
    },
  });

  // Raise an ops review flag on mismatch — never an auto-reject.
  if (mismatchFlag) {
    await prisma.reviewFlag.create({
      data: {
        userId: user.id,
        type: "self_report_mismatch",
        context: { domains: mismatches, calibrationScores },
        note: "Self-rating 'Extensive' with sub-40% calibration.",
      },
    });
  }

  // Certifications claimed → flag for manual verification (never auto-trusted).
  if (input.certifications && input.certifications.trim().length > 0) {
    await prisma.reviewFlag.create({
      data: {
        userId: user.id,
        type: "identity_reverification",
        context: { certifications: input.certifications },
        note: "Claimed credentials — manual verification before any T3 access.",
      },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { applicationStage: furthestStage(user.applicationStage, "qualification_test") },
  });

  return NextResponse.json({ ok: true, calibrationScores, routedTracks });
}
