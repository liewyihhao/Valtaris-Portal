import { describe, it, expect } from "vitest";
import { projectActiveOutput, rate } from "../forecast";
import { certificateStatus } from "../certificate";

describe("capacity forecasting math (§2.7)", () => {
  it("projects intake × pass-rate × active-rate, rounded", () => {
    expect(projectActiveOutput(500, 0.7, 0.6)).toBe(210);
    expect(projectActiveOutput(100, 0.85, 0.9)).toBe(77); // 76.5 → 77
  });

  it("rate is a safe [0,1] ratio, 0 on empty denominator", () => {
    expect(rate(7, 10)).toBe(0.7);
    expect(rate(0, 0)).toBe(0);
    expect(rate(5, 0)).toBe(0);
    expect(rate(20, 10)).toBe(1); // clamped
  });
});

describe("certificate validity (§2.3) — cross-checks the live qualification", () => {
  const base = { revokedAt: null, certTier: "T2_skilled", qualStatus: "active", qualTier: "T2_skilled" };

  it("is valid when active and tiers match", () => {
    expect(certificateStatus(base)).toEqual({ valid: true, reason: "valid" });
  });

  it("is invalid when explicitly revoked", () => {
    expect(certificateStatus({ ...base, revokedAt: new Date() }).valid).toBe(false);
  });

  it("is invalid when the qualification is no longer active", () => {
    expect(certificateStatus({ ...base, qualStatus: "suspended" })).toEqual({ valid: false, reason: "qualification_suspended" });
    expect(certificateStatus({ ...base, qualStatus: null })).toEqual({ valid: false, reason: "no_qualification" });
  });

  it("is invalid (superseded) when the current tier differs from the certified tier", () => {
    expect(certificateStatus({ ...base, qualTier: "T1_associate" })).toEqual({ valid: false, reason: "tier_changed" });
  });
});
