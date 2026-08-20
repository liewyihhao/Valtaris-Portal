import type { ApplicationStage } from "./constants";

// Ordered funnel stages + the stepper labels used on /apply.
export const FUNNEL_STAGES: ApplicationStage[] = [
  "eligibility",
  "questionnaire",
  "qualification_test",
  "guidelines",
  "agreements",
  "approved",
];

export const FUNNEL_STEPS = [
  { key: "eligibility", label: "Eligibility" },
  { key: "questionnaire", label: "Questionnaire" },
  { key: "qualification_test", label: "Qualification test" },
  { key: "guidelines", label: "Guidelines" },
  { key: "agreements", label: "Agreements" },
  { key: "approved", label: "Approved" },
];

export function stageIndex(stage: string): number {
  return FUNNEL_STAGES.indexOf(stage as ApplicationStage);
}

/** Advance to `next` only if it's actually ahead of the current stage.
 *  `current` is accepted as a plain string (Prisma returns a string). */
export function furthestStage(current: string, next: ApplicationStage): ApplicationStage {
  return stageIndex(next) > stageIndex(current) ? next : (current as ApplicationStage);
}

export const STAGE_CTA: Record<ApplicationStage, { title: string; href: string; cta: string }> = {
  eligibility: {
    title: "Check your eligibility",
    href: "/apply/eligibility",
    cta: "Start eligibility check",
  },
  questionnaire: {
    title: "Complete the screening questionnaire",
    href: "/apply/questionnaire",
    cta: "Continue questionnaire",
  },
  qualification_test: {
    title: "Take your qualification test",
    href: "/apply/questionnaire", // routed track determines the exam link
    cta: "Go to your test",
  },
  guidelines: {
    title: "Review the task guidelines",
    href: "/apply/guidelines",
    cta: "Read guidelines",
  },
  agreements: {
    title: "Sign your agreements & tax form",
    href: "/apply/agreements",
    cta: "Review & sign",
  },
  approved: {
    title: "You're approved",
    href: "/apply/approved",
    cta: "Go to your dashboard",
  },
};
