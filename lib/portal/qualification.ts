import { prisma } from "@/lib/db";
import { writeAudit } from "./audit";
import { notify } from "./notify";
import { t } from "./i18n";
import { PASS_THRESHOLD, TIER_LABEL, type Tier, type TestTrack } from "./constants";

// ---------------------------------------------------------------------------
// QUALIFICATION SCORING SERVICE
//
// This module is the ONLY place in the codebase that writes Qualification.tier.
// The questionnaire flow, the UI, and admin CRUD must never set tier directly —
// tier is a pure function of verified qualification-test performance.
// See docs/architecture.md ("self-report vs verified boundary").
// ---------------------------------------------------------------------------

/** Map a test score + which test track to the tier it earns. */
export function tierForScore(testTrack: TestTrack, score: number): Tier {
  if (testTrack === "standard") {
    if (score >= PASS_THRESHOLD.specialist_t3) return "T3_specialist";
    if (score >= PASS_THRESHOLD.standard_t2) return "T2_skilled";
    if (score >= PASS_THRESHOLD.foundational) return "T1_associate";
    return "T0_trainee"; // did not pass — stays a trainee
  }
  // foundational / training_then_foundational cap at T1.
  if (score >= PASS_THRESHOLD.foundational) return "T1_associate";
  return "T0_trainee";
}

export function isPassing(tier: Tier): boolean {
  return tier !== "T0_trainee";
}

/**
 * Record a qualification-test attempt and, on a pass, set the verified tier.
 * Returns the resulting tier + pass flag. Writes an audit row for provenance.
 */
export async function scoreQualificationAttempt(params: {
  userId: string;
  trackId: string;
  testTrack: TestTrack;
  score: number;
  labelStudioProjectId?: string | null;
  actorId?: string | null;
}) {
  const { userId, trackId, testTrack, score } = params;
  const tier = tierForScore(testTrack, score);
  const passed = isPassing(tier);

  const attempt = await prisma.qualificationTestAttempt.create({
    data: {
      userId,
      trackId,
      testTrack,
      score,
      passed,
      attemptedAt: new Date(),
      labelStudioProjectId: params.labelStudioProjectId ?? null,
      // 24h cooldown before a retry if failed.
      cooldownUntil: passed ? null : new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  if (passed) {
    const existing = await prisma.qualification.findUnique({
      where: { userId_trackId: { userId, trackId } },
    });

    const before = existing ? { tier: existing.tier, status: existing.status } : null;

    const qualification = await prisma.qualification.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: {
        userId,
        trackId,
        tier,
        status: "active",
        verifiedAt: new Date(),
        sourceAttemptId: attempt.id,
        recertDueAt: new Date(Date.now() + 180 * 24 * 3600 * 1000), // 6 months
      },
      update: {
        tier,
        status: "active",
        verifiedAt: new Date(),
        sourceAttemptId: attempt.id,
      },
    });

    await writeAudit({
      entityType: "Qualification",
      entityId: qualification.id,
      action: existing ? "tier_updated" : "tier_set",
      actorId: params.actorId ?? null,
      before: before ?? undefined,
      after: { tier, status: "active", sourceAttemptId: attempt.id },
    });

    // Validator eligibility is derived from current tier — a drop below T2
    // suspends the linked capability (integration spec §4).
    const { syncValidatorWithTier } = await import("./validator");
    await syncValidatorWithTier(userId, trackId, tier);

    // Issue/refresh the verifiable certificate for the earned tier.
    const { issueCertificate } = await import("./certificate");
    await issueCertificate({ userId, trackId, tier, sourceQualificationId: qualification.id });
  }

  // Notify the applicant of the exam outcome. Transactional on a pass (high
  // priority); lifecycle on a fail so it batches with other coaching nudges.
  // The notification links to detail — it never replaces the tier record itself.
  const track = await prisma.track.findUnique({ where: { id: trackId }, select: { name: true } });
  const trackName = track?.name ?? "your track";
  if (passed) {
    await notify({
      userId,
      category: "assessment",
      title: t("notif.exam.pass.title", { track: trackName }),
      body: t("notif.exam.pass.body", { tier: TIER_LABEL[tier], track: trackName }),
      deepLink: "/my-work",
      email: true,
    });
  } else {
    await notify({
      userId,
      type: "lifecycle",
      category: "assessment",
      title: t("notif.exam.fail.title", { track: trackName }),
      body: t("notif.exam.fail.body", { score, track: trackName }),
      deepLink: "/learn",
      email: true,
    });
  }

  return { attempt, tier, passed };
}
