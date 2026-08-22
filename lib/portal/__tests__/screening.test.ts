import { describe, it, expect } from "vitest";
import { needsRescreen } from "../screening";
import { laborRiskFor } from "../labor";

const DAY = 24 * 3600 * 1000;

describe("needsRescreen — sanctions cadence (§2.12)", () => {
  const now = new Date("2026-08-22T00:00:00Z");

  it("is always due when never screened", () => {
    expect(needsRescreen(null, now)).toBe(true);
    expect(needsRescreen(undefined, now)).toBe(true);
  });

  it("is not due within the cadence window", () => {
    expect(needsRescreen(new Date(now.getTime() - 10 * DAY), now)).toBe(false);
    expect(needsRescreen(new Date(now.getTime() - 89 * DAY), now)).toBe(false);
  });

  it("is due once the cadence window has elapsed", () => {
    expect(needsRescreen(new Date(now.getTime() - 90 * DAY), now)).toBe(true);
    expect(needsRescreen(new Date(now.getTime() - 200 * DAY), now)).toBe(true);
  });
});

describe("laborRiskFor — classification checklist (§2.12)", () => {
  it("returns curated risk for known jurisdictions", () => {
    expect(laborRiskFor("Spain").risk).toBe("high");
    expect(laborRiskFor("United States").risk).toBe("high");
    expect(laborRiskFor("India").risk).toBe("low");
  });

  it("defaults unknown countries to 'review needed' rather than a silent pass", () => {
    const r = laborRiskFor("Atlantis");
    expect(r.risk).toBe("medium");
    expect(r.note.toLowerCase()).toContain("not yet reviewed");
  });
});
