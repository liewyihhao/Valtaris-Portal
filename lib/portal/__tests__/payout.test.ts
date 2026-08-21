import { describe, it, expect } from "vitest";
import {
  computePayout,
  tierMultiplier,
  validateTransition,
  canTransition,
  isAppealable,
  isHoldExpired,
  holdExpiry,
  canRequestPayout,
  isBelowFloor,
} from "../payout";

describe("rate computation", () => {
  it("applies base × complexity × tier × items and rounds to cents", () => {
    // 0.18 × 1.0 × 1.25 (T2) × 100 = 22.5
    expect(
      computePayout({ baseRate: 0.18, complexityMultiplier: 1, tier: "T2_skilled", itemCount: 100 })
    ).toBe(22.5);
  });

  it("uses default tier multipliers", () => {
    expect(tierMultiplier("T1_associate")).toBe(1.0);
    expect(tierMultiplier("T2_skilled")).toBe(1.25);
    expect(tierMultiplier("T3_specialist")).toBe(1.5);
    expect(tierMultiplier("T0_trainee")).toBe(0.5);
  });

  it("flags effective per-item pay below the floor", () => {
    expect(isBelowFloor(0.04, 0.05)).toBe(true);
    expect(isBelowFloor(0.06, 0.05)).toBe(false);
  });
});

describe("payout state machine", () => {
  it("allows the documented happy path", () => {
    expect(canTransition({ from: "pending_qa", to: "approved" })).toBe(true);
    expect(canTransition({ from: "approved", to: "paid" })).toBe(true);
  });

  it("allows pending_qa → held → approved", () => {
    expect(canTransition({ from: "pending_qa", to: "held" })).toBe(true);
    expect(canTransition({ from: "held", to: "approved" })).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition({ from: "pending_qa", to: "paid" })).toBe(false);
    expect(canTransition({ from: "paid", to: "approved" })).toBe(false);
    expect(canTransition({ from: "rejected", to: "approved" })).toBe(false);
  });

  it("requires a reason code to reject", () => {
    const bad = validateTransition({ from: "pending_qa", to: "rejected" });
    expect(bad.ok).toBe(false);
    const good = validateTransition({
      from: "pending_qa",
      to: "rejected",
      reasonCode: "failed_gold_task",
    });
    expect(good.ok).toBe(true);
  });

  it("requires a detail for guideline_violation and confirmed_fraud", () => {
    expect(
      validateTransition({
        from: "pending_qa",
        to: "rejected",
        reasonCode: "guideline_violation",
      }).ok
    ).toBe(false);
    expect(
      validateTransition({
        from: "pending_qa",
        to: "rejected",
        reasonCode: "guideline_violation",
        reasonDetail: "rule_4.2_bbox_tightness",
      }).ok
    ).toBe(true);
  });

  it("only allows clawback for confirmed fraud", () => {
    expect(
      validateTransition({
        from: "paid",
        to: "clawed_back",
        reasonCode: "below_consensus_threshold",
      }).ok
    ).toBe(false);
    expect(
      validateTransition({
        from: "paid",
        to: "clawed_back",
        reasonCode: "confirmed_fraud",
        reasonDetail: "llm_generated_batch",
      }).ok
    ).toBe(true);
  });

  it("marks rejected and clawed_back as appealable", () => {
    expect(isAppealable("rejected")).toBe(true);
    expect(isAppealable("clawed_back")).toBe(true);
    expect(isAppealable("paid")).toBe(false);
  });
});

describe("hold window", () => {
  it("expiry is 72h out", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    expect(holdExpiry(from).toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("detects an expired hold", () => {
    const exp = new Date("2026-01-01T00:00:00Z");
    expect(isHoldExpired(exp, new Date("2026-01-02T00:00:00Z"))).toBe(true);
    expect(isHoldExpired(exp, new Date("2025-12-31T00:00:00Z"))).toBe(false);
    expect(isHoldExpired(null)).toBe(false);
  });
});

describe("payout request eligibility", () => {
  it("enforces the $20 threshold normally", () => {
    expect(canRequestPayout({ availableBalance: 19.99, accountClosing: false })).toBe(false);
    expect(canRequestPayout({ availableBalance: 20, accountClosing: false })).toBe(true);
  });

  it("never strands a small balance on account closure", () => {
    expect(canRequestPayout({ availableBalance: 3.5, accountClosing: true })).toBe(true);
    expect(canRequestPayout({ availableBalance: 0, accountClosing: true })).toBe(false);
  });
});

describe("validator human-review branch", () => {
  it("routes pending_qa to human review", () => {
    expect(canTransition({ from: "pending_qa", to: "pending_human_review" })).toBe(true);
  });
  it("validator approve/reject/correction/escalate from human review", () => {
    expect(canTransition({ from: "pending_human_review", to: "approved" })).toBe(true);
    expect(validateTransition({ from: "pending_human_review", to: "rejected", reasonCode: "guideline_violation", reasonDetail: "sarcasm_handling" }).ok).toBe(true);
    expect(canTransition({ from: "pending_human_review", to: "correction_requested" })).toBe(true);
    expect(canTransition({ from: "pending_human_review", to: "escalated" })).toBe(true);
  });
  it("reject from human review still requires a reason code", () => {
    expect(validateTransition({ from: "pending_human_review", to: "rejected" }).ok).toBe(false);
  });
  it("correction can re-review or expire to rejected", () => {
    expect(canTransition({ from: "correction_requested", to: "pending_human_review" })).toBe(true);
    expect(validateTransition({ from: "correction_requested", to: "rejected", reasonCode: "no_response_after_correction_request" }).ok).toBe(true);
  });
  it("escalated resolves to approved or rejected by ops", () => {
    expect(canTransition({ from: "escalated", to: "approved" })).toBe(true);
    expect(validateTransition({ from: "escalated", to: "rejected", reasonCode: "failed_gold_task" }).ok).toBe(true);
  });
  it("does not allow skipping straight from pending_human_review to paid", () => {
    expect(canTransition({ from: "pending_human_review", to: "paid" })).toBe(false);
  });
});
