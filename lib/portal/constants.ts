// Shared constants + string-union types mirroring the Prisma enums.
// Kept dependency-free so the business logic (payout, questionnaire) can be
// unit-tested without importing the Prisma client.

export type Tier = "T0_trainee" | "T1_associate" | "T2_skilled" | "T3_specialist";
export type Domain = "text_nlp" | "image" | "video" | "audio" | "llm_eval" | "other";
export type TestTrack = "training_then_foundational" | "foundational" | "standard";
export type PayoutProvider = "payoneer" | "wise" | "bank_transfer";
export type ApplicationStage =
  | "eligibility"
  | "questionnaire"
  | "qualification_test"
  | "guidelines"
  | "agreements"
  | "approved";
export type SelfRating = "Extensive" | "Moderate" | "Basic" | "None";
export type PayoutStatus =
  | "pending_qa"
  | "held"
  | "approved"
  | "paid"
  | "rejected"
  | "clawed_back";
export type PayoutReasonCode =
  | "failed_gold_task"
  | "below_consensus_threshold"
  | "guideline_violation"
  | "confirmed_fraud";

// Tier multipliers — configurable via rate cards, these are the defaults.
export const TIER_MULTIPLIER: Record<Tier, number> = {
  T0_trainee: 0.5, // supervised/reduced-rate practice
  T1_associate: 1.0,
  T2_skilled: 1.25,
  T3_specialist: 1.5,
};

export const TIER_LABEL: Record<Tier, string> = {
  T0_trainee: "T0 · Trainee",
  T1_associate: "T1 · Associate",
  T2_skilled: "T2 · Skilled",
  T3_specialist: "T3 · Specialist",
};

// Qualification-test pass thresholds (percent) per Section 7 of the build prompt.
export const PASS_THRESHOLD = {
  foundational: 70, // → T1
  standard_t2: 85, // → T2
  specialist_t3: 95, // → T3
} as const;

// Questionnaire calibration routing thresholds (percent).
export const CALIBRATION_ROUTING = {
  standard: 70, // >=70 → STANDARD test (targets T1/T2)
  foundational: 40, // >=40 → FOUNDATIONAL test (T1); below → training first
} as const;

// Payout policy.
export const MIN_PAYOUT_THRESHOLD_USD = 20;
export const PENDING_QA_MAX_HOLD_HOURS = 72; // published max hold window
export const APPEAL_SLA_BUSINESS_DAYS = 3;
export const DOMAIN_LABEL: Record<Domain, string> = {
  text_nlp: "Text / NLP",
  image: "Image",
  video: "Video",
  audio: "Audio / Speech",
  llm_eval: "LLM / Chatbot Evaluation",
  other: "Specialized vertical",
};
