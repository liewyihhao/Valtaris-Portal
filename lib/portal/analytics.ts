import { prisma } from "@/lib/db";

// Recruitment funnel: counts at each stage (applied → … → active).
export async function getFunnel() {
  const [applied, questionnaire, examAttempted, examPassed, approved, active] = await Promise.all([
    prisma.user.count({ where: { role: { in: ["applicant", "annotator"] } } }),
    prisma.questionnaireResponse.count(),
    prisma.qualificationTestAttempt.count(),
    prisma.qualificationTestAttempt.count({ where: { passed: true } }),
    prisma.user.count({ where: { applicationStage: "approved" } }),
    prisma.user.count({ where: { role: "annotator", status: "active" } }),
  ]);
  const stages = [
    { key: "applied", label: "Signed up", n: applied },
    { key: "questionnaire", label: "Screened", n: questionnaire },
    { key: "exam_attempted", label: "Exam attempted", n: examAttempted },
    { key: "exam_passed", label: "Exam passed", n: examPassed },
    { key: "approved", label: "Approved", n: approved },
    { key: "active", label: "Active", n: active },
  ];
  // Conversion vs the first stage.
  const base = applied || 1;
  return stages.map((s) => ({ ...s, pct: Math.round((s.n / base) * 100) }));
}

// Quality & trust trend proxies (point-in-time at this scale).
export async function getQualityTrust() {
  const [decided, approved, paid, rejected, clawed, appealsOpen, fraudFlags] = await Promise.all([
    prisma.payout.count({ where: { status: { in: ["approved", "paid", "rejected", "clawed_back"] } } }),
    prisma.payout.count({ where: { status: "approved" } }),
    prisma.payout.count({ where: { status: "paid" } }),
    prisma.payout.count({ where: { status: "rejected" } }),
    prisma.payout.count({ where: { status: "clawed_back" } }),
    prisma.appeal.count({ where: { status: { in: ["open", "under_review"] } } }),
    prisma.reviewFlag.count({ where: { type: "fraud_suspected", status: "open" } }),
  ]);
  const good = approved + paid;
  return {
    qaApprovalRate: decided ? Math.round((good / decided) * 100) : null,
    rejected, clawed, appealsOpen, fraudFlags,
  };
}

// Payout health.
export async function getPayoutHealth() {
  const payouts = await prisma.payout.findMany({ select: { status: true, grossAmount: true, holdExpiresAt: true, paidAt: true } });
  const now = Date.now();
  let owed = 0, paid7 = 0, breached = 0;
  const weekAgo = now - 7 * 864e5;
  for (const p of payouts) {
    if (p.status === "approved") owed += p.grossAmount;
    if (p.status === "paid" && p.paidAt && p.paidAt.getTime() >= weekAgo) paid7 += p.grossAmount;
    if ((p.status === "pending_qa" || p.status === "pending_human_review" || p.status === "held") && p.holdExpiresAt && p.holdExpiresAt.getTime() < now) breached += 1;
  }
  return { owed: Math.round(owed * 100) / 100, paid7: Math.round(paid7 * 100) / 100, slaBreaches: breached };
}

// Validator capacity ratio.
export async function getValidatorCapacity() {
  const [validators, annotators, openReviews] = await Promise.all([
    prisma.validatorCapability.count({ where: { status: "active" } }),
    prisma.user.count({ where: { role: "annotator", status: "active" } }),
    prisma.reviewAssignment.count({ where: { decision: null } }),
  ]);
  return { validators, annotators, openReviews, ratio: validators ? Math.round(annotators / validators) : null };
}
