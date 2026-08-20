// Questionnaire routing & scoring — pure logic, per Section 6 of the build
// prompt and Section 3 of the skills-questionnaire spec.
//
// HARD RULE held throughout: the questionnaire NEVER sets an annotator's tier.
// It only (a) computes a calibration score to route to the right test track,
// and (b) raises a mismatch flag for ops when self-report and calibration
// diverge. Tier is written exclusively by lib/portal/qualification scoring.

import {
  CALIBRATION_ROUTING,
  type SelfRating,
  type TestTrack,
} from "./constants";

export type CalibrationAnswer = {
  questionId: string;
  // Selected option index (for multiple choice) or free-text (rubric-graded).
  selectedIndex?: number;
  freeText?: string;
};

export type CalibrationKey = {
  questionId: string;
  correctIndex: number | null; // null → rubric/free-text, not auto-scored
};

/**
 * Compute % correct over the auto-gradable (multiple-choice) items only.
 * Free-text/rubric items are excluded from the automatic score — they go to a
 * rubric/ops signal, never silently counted as wrong.
 */
export function computeCalibrationScore(
  answers: CalibrationAnswer[],
  keys: CalibrationKey[]
): number {
  const gradable = keys.filter((k) => k.correctIndex !== null);
  if (gradable.length === 0) return 0;

  const byId = new Map(answers.map((a) => [a.questionId, a]));
  let correct = 0;
  for (const key of gradable) {
    const ans = byId.get(key.questionId);
    if (ans && ans.selectedIndex === key.correctIndex) correct += 1;
  }
  return Math.round((correct / gradable.length) * 100);
}

/**
 * Route a domain's calibration score to a qualification test track.
 *   >= 70%  → STANDARD (targets T1/T2)
 *   >= 40%  → FOUNDATIONAL (targets T1)
 *   < 40%   → training module first, then FOUNDATIONAL
 */
export function routeTestTrack(calibrationScore: number): TestTrack {
  if (calibrationScore >= CALIBRATION_ROUTING.standard) return "standard";
  if (calibrationScore >= CALIBRATION_ROUTING.foundational) return "foundational";
  return "training_then_foundational";
}

/**
 * Self-report / calibration mismatch: claims "Extensive" but scores below the
 * foundational floor. This is a flag for /admin review, NEVER an auto-reject.
 */
export function isSelfReportMismatch(
  selfRating: SelfRating,
  calibrationScore: number
): boolean {
  return (
    selfRating === "Extensive" &&
    calibrationScore < CALIBRATION_ROUTING.foundational
  );
}

export type DomainRoutingInput = {
  domain: string;
  selfRating: SelfRating;
  answers: CalibrationAnswer[];
  keys: CalibrationKey[];
};

export type DomainRoutingResult = {
  domain: string;
  calibrationScore: number;
  routedTrack: TestTrack;
  mismatchFlag: boolean;
};

/** Run the full per-domain routing pass for a questionnaire submission. */
export function routeQuestionnaire(
  domains: DomainRoutingInput[]
): DomainRoutingResult[] {
  return domains.map((d) => {
    const calibrationScore = computeCalibrationScore(d.answers, d.keys);
    return {
      domain: d.domain,
      calibrationScore,
      routedTrack: routeTestTrack(calibrationScore),
      mismatchFlag: isSelfReportMismatch(d.selfRating, calibrationScore),
    };
  });
}
