// ---------------------------------------------------------------------------
// WORKER STANDING — the API-first read boundary (master design §9).
//
// Everything the future bridge needs to read about a worker (current tier per
// track, account status, validator-capability status) exposed as one shaped
// payload, so the bridge queries a stable contract rather than application
// tables. The HR Portal remains the single source of truth for identity, tier,
// validator standing, and eligibility.
// ---------------------------------------------------------------------------

export type WorkerStanding = {
  userId: string;
  accountStatus: string; // active | dormant | suspended | purged
  qualifications: { trackSlug: string; trackName: string; tier: string; status: string }[];
  validatorCapabilities: { trackSlug: string; status: string }[];
};

/** Build a worker's standing payload, or null if the user doesn't exist. */
export async function getWorkerStanding(userId: string): Promise<WorkerStanding | null> {
  const { prisma } = await import("@/lib/db");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      qualifications: { select: { tier: true, status: true, track: { select: { slug: true, name: true } } } },
      validatorCapabilities: { select: { status: true, track: { select: { slug: true } } } },
    },
  });
  if (!user) return null;

  return {
    userId: user.id,
    accountStatus: user.status,
    qualifications: user.qualifications.map((q) => ({
      trackSlug: q.track.slug,
      trackName: q.track.name,
      tier: q.tier,
      status: q.status,
    })),
    validatorCapabilities: user.validatorCapabilities.map((v) => ({
      trackSlug: v.track.slug,
      status: v.status,
    })),
  };
}
