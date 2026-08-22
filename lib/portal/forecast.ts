// ---------------------------------------------------------------------------
// CAPACITY FORECASTING (master design §2.7).
//
// Given a projected intake for a track and that track's historical pass-rate
// (exam attempts) and active-rate (certified → still-active), project how many
// active certified annotators the intake likely yields. Feeds Recruiter funnel
// targets and Validator supply planning. A saved WorkforceForecast is a
// snapshot ("what we projected at time T"). Top level is prisma-free so the
// pure projection math stays unit-testable.
// ---------------------------------------------------------------------------

/** projected active output = intake × pass-rate × active-rate, rounded. Pure. */
export function projectActiveOutput(intake: number, passRate: number, activeRate: number): number {
  return Math.round(intake * passRate * activeRate);
}

/** Safe ratio in [0,1]; 0 when the denominator is 0. Pure. */
export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}

export type TrackForecast = {
  historicalPassRate: number;
  historicalActiveRate: number;
  projectedActiveOutput: number;
  sampleAttempts: number;
  sampleCertified: number;
};

/**
 * Compute (but do not persist) a forecast for a track from live history.
 * passRate = passed exam attempts / gradable attempts;
 * activeRate = active certified annotators / all certified in the track.
 */
export async function computeTrackForecast(trackId: string, projectedIntake: number): Promise<TrackForecast> {
  const { prisma } = await import("@/lib/db");

  const [gradable, passed, certified, activeCertified] = await Promise.all([
    prisma.qualificationTestAttempt.count({ where: { trackId, passed: { not: null } } }),
    prisma.qualificationTestAttempt.count({ where: { trackId, passed: true } }),
    prisma.qualification.count({ where: { trackId, status: "active" } }),
    prisma.qualification.count({ where: { trackId, status: "active", user: { status: "active" } } }),
  ]);

  const historicalPassRate = rate(passed, gradable);
  const historicalActiveRate = rate(activeCertified, certified);
  return {
    historicalPassRate,
    historicalActiveRate,
    projectedActiveOutput: projectActiveOutput(projectedIntake, historicalPassRate, historicalActiveRate),
    sampleAttempts: gradable,
    sampleCertified: certified,
  };
}

/** Compute and persist a WorkforceForecast snapshot. */
export async function saveTrackForecast(params: { trackId: string; projectedIntake: number; generatedById?: string | null }) {
  const { prisma } = await import("@/lib/db");
  const f = await computeTrackForecast(params.trackId, params.projectedIntake);
  return prisma.workforceForecast.create({
    data: {
      trackId: params.trackId,
      projectedIntake: params.projectedIntake,
      historicalPassRate: f.historicalPassRate,
      historicalActiveRate: f.historicalActiveRate,
      projectedActiveOutput: f.projectedActiveOutput,
      generatedById: params.generatedById ?? null,
    },
  });
}
