// Payout computation + state machine — pure logic, per Section 7 of the build
// prompt and Sections 1.1–1.3 of the payout spec. No DB imports so it is fully
// unit-testable.

import {
  MIN_PAYOUT_THRESHOLD_USD,
  PENDING_QA_MAX_HOLD_HOURS,
  TIER_MULTIPLIER,
  type PayoutReasonCode,
  type PayoutStatus,
  type Tier,
} from "./constants";

// -------------------------------------------------------------------------
// Rate computation: payout = base_rate × complexity_multiplier × tier_multiplier
// -------------------------------------------------------------------------

export function tierMultiplier(tier: Tier): number {
  return TIER_MULTIPLIER[tier];
}

export function computePayout(params: {
  baseRate: number;
  complexityMultiplier: number;
  tier: Tier;
  itemCount: number;
}): number {
  const { baseRate, complexityMultiplier, tier, itemCount } = params;
  const perItem = baseRate * complexityMultiplier * tierMultiplier(tier);
  // Round to cents.
  return Math.round(perItem * itemCount * 100) / 100;
}

/** The floor is a hard published minimum per task type (anti race-to-bottom). */
export function isBelowFloor(effectivePerItem: number, floorRate: number): boolean {
  return effectivePerItem < floorRate;
}

// -------------------------------------------------------------------------
// State machine
// -------------------------------------------------------------------------

// Allowed transitions. Anything not listed here is rejected by the guard.
// The human-review branch (Validator role) extends the original machine.
const TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  pending_qa: ["pending_human_review", "held", "approved", "rejected"],
  // Routed to a Validator (probation / sample / borderline / appeal).
  pending_human_review: ["approved", "rejected", "correction_requested", "escalated"],
  // Annotator gets a bounded window to resubmit → re-review, else rejected.
  correction_requested: ["pending_human_review", "rejected"],
  // Beyond a Validator's authority → Ops decides.
  escalated: ["approved", "rejected"],
  held: ["approved", "rejected"], // human review resolves a hold
  approved: ["paid", "clawed_back"],
  paid: ["clawed_back"],
  rejected: [], // terminal (appeal restores via a fresh row/override, not a transition)
  clawed_back: [], // terminal
};

// These statuses cannot be entered without a specific reason code.
const REQUIRES_REASON: PayoutStatus[] = ["rejected", "clawed_back"];

// guideline_violation / confirmed_fraud additionally require a detail string.
const REASONS_REQUIRING_DETAIL: PayoutReasonCode[] = [
  "guideline_violation",
  "confirmed_fraud",
];

// Clawback is reserved for confirmed fraud — ordinary QA misses are not clawed
// back (payout spec 1.3).
const CLAWBACK_ALLOWED_REASONS: PayoutReasonCode[] = ["confirmed_fraud"];

export type TransitionInput = {
  from: PayoutStatus;
  to: PayoutStatus;
  reasonCode?: PayoutReasonCode | null;
  reasonDetail?: string | null;
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateTransition(input: TransitionInput): TransitionResult {
  const { from, to, reasonCode, reasonDetail } = input;

  if (from === to) return { ok: false, error: `No-op transition (${from}).` };

  if (!TRANSITIONS[from]?.includes(to)) {
    return { ok: false, error: `Illegal transition ${from} → ${to}.` };
  }

  if (REQUIRES_REASON.includes(to) && !reasonCode) {
    return {
      ok: false,
      error: `Transition to ${to} requires a specific reason code (never a bare "inaccurate work").`,
    };
  }

  if (
    reasonCode &&
    REASONS_REQUIRING_DETAIL.includes(reasonCode) &&
    !reasonDetail?.trim()
  ) {
    return {
      ok: false,
      error: `Reason code "${reasonCode}" requires a detail (the specific rule / fraud type).`,
    };
  }

  if (to === "clawed_back" && reasonCode && !CLAWBACK_ALLOWED_REASONS.includes(reasonCode)) {
    return {
      ok: false,
      error: `Clawback is reserved for confirmed fraud, not "${reasonCode}" (ordinary QA variance is a coaching signal, not a pay cut).`,
    };
  }

  return { ok: true };
}

export function canTransition(input: TransitionInput): boolean {
  return validateTransition(input).ok;
}

/** Every rejected/clawed_back payout is appealable. */
export function isAppealable(status: PayoutStatus): boolean {
  return status === "rejected" || status === "clawed_back";
}

// -------------------------------------------------------------------------
// Hold window helpers
// -------------------------------------------------------------------------

export function holdExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + PENDING_QA_MAX_HOLD_HOURS * 3600 * 1000);
}

/** pending_qa past its published max hold must escalate to human review. */
export function isHoldExpired(holdExpiresAt: Date | null, now: Date = new Date()): boolean {
  if (!holdExpiresAt) return false;
  return now.getTime() > holdExpiresAt.getTime();
}

// -------------------------------------------------------------------------
// Payout eligibility (threshold + cadence)
// -------------------------------------------------------------------------

export function canRequestPayout(params: {
  availableBalance: number;
  accountClosing: boolean;
}): boolean {
  // Small balances are never stranded when an account is closing.
  if (params.accountClosing) return params.availableBalance > 0;
  return params.availableBalance >= MIN_PAYOUT_THRESHOLD_USD;
}
