// ---------------------------------------------------------------------------
// GUIDELINE VERSIONING + RECERTIFICATION "WHAT CHANGED" PUSH (master design
// §2.2, §2.3). Bumping a track's guideline version publishes a new
// GuidelineVersion and pushes a short "what changed" recert module + a
// notification to every annotator currently certified in that track — not the
// full course again (that would be enormous unnecessary load at 10k people).
//
// This is coaching, never a trust boundary: the recert module is non-gating
// (like all Learning Center content) and does not touch tier. Top level is kept
// prisma-free so the pure helpers stay unit-testable without a DB.
// ---------------------------------------------------------------------------

// Recert modules are ordinary TrainingCourses tagged by a title prefix (no
// schema change needed) so /learn can flag them and we can dedupe per version.
export const RECERT_TITLE_PREFIX = "Recert:";

/** Deterministic recert-module title for a (track, version) — also the dedupe key. */
export function recertModuleTitle(trackName: string, version: number): string {
  return `${RECERT_TITLE_PREFIX} What changed — ${trackName} guidelines v${version}`;
}

/** Next version number given the current max (null when none published yet). */
export function nextGuidelineVersion(currentMax: number | null | undefined): number {
  return (currentMax ?? 0) + 1;
}

/** True when a course is a recert "what changed" module (by title convention). */
export function isRecertModule(title: string): boolean {
  return title.startsWith(RECERT_TITLE_PREFIX);
}

export type PublishGuidelineResult = {
  versionId: string;
  version: number;
  recertCourseId: string;
  affectedCount: number;
};

/**
 * Publish a new guideline version for a track and push the recert module +
 * notification to affected (currently-certified) annotators.
 *
 * `changeSummary` is the ops-authored "what changed" text that becomes the
 * recert module's single lesson. The notification fan-out is queued (async job)
 * so a bump affecting thousands of annotators never blocks the request.
 */
export async function publishGuidelineVersion(params: {
  trackId: string;
  title: string;
  content: string;
  changeSummary: string;
  actorId?: string | null;
}): Promise<PublishGuidelineResult> {
  const { prisma } = await import("@/lib/db");
  const { writeAudit } = await import("./audit");
  const { enqueueBroadcast } = await import("./notify");

  const track = await prisma.track.findUnique({ where: { id: params.trackId }, select: { name: true } });
  const trackName = track?.name ?? "your track";

  const currentMax = await prisma.guidelineVersion.aggregate({
    where: { trackId: params.trackId },
    _max: { version: true },
  });
  const version = nextGuidelineVersion(currentMax._max.version);

  // Un-set the previous current version, then publish the new one as current.
  await prisma.guidelineVersion.updateMany({
    where: { trackId: params.trackId, isCurrent: true },
    data: { isCurrent: false },
  });
  const gv = await prisma.guidelineVersion.create({
    data: {
      trackId: params.trackId,
      version,
      title: params.title,
      content: params.content,
      isCurrent: true,
    },
  });

  // Create the recert "what changed" module (dedupe by deterministic title).
  const moduleTitle = recertModuleTitle(trackName, version);
  let recertCourse = await prisma.trainingCourse.findFirst({
    where: { trackId: params.trackId, title: moduleTitle },
    select: { id: true },
  });
  if (!recertCourse) {
    recertCourse = await prisma.trainingCourse.create({
      data: {
        trackId: params.trackId,
        title: moduleTitle,
        description: `Guideline v${version} update for ${trackName} — a short review of what changed. Coaching only; your tier is unaffected.`,
        version,
        isMandatory: false,
        isPublished: true,
        lessons: {
          create: {
            order: 1,
            title: `What changed in v${version}`,
            content: params.changeSummary,
            hasKnowledgeCheck: false,
          },
        },
      },
      select: { id: true },
    });
  }

  // Affected = annotators currently certified (active qualification) in this track.
  const affected = await prisma.qualification.findMany({
    where: { trackId: params.trackId, status: "active" },
    select: { userId: true },
  });
  const userIds = [...new Set(affected.map((q) => q.userId))];

  if (userIds.length > 0) {
    await enqueueBroadcast({
      userIds,
      category: "training",
      title: `Guideline update — ${trackName} v${version}`,
      body: `The ${trackName} guidelines were updated to v${version}. A short "what changed" module is in your Learning Center — please review it before your next task.`,
      deepLink: "/learn",
    });
  }

  await writeAudit({
    entityType: "GuidelineVersion",
    entityId: gv.id,
    action: "guideline_version_published",
    actorId: params.actorId ?? null,
    after: { trackId: params.trackId, version, recertCourseId: recertCourse.id, affectedCount: userIds.length },
  });

  return { versionId: gv.id, version, recertCourseId: recertCourse.id, affectedCount: userIds.length };
}
