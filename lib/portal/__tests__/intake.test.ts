import { describe, it, expect } from "vitest";
import { normalizeChannel } from "../intake";

describe("normalizeChannel — intake cohort tagging (§2.7)", () => {
  it("passes through known acquisition channels", () => {
    expect(normalizeChannel("referral")).toBe("referral");
    expect(normalizeChannel("paid")).toBe("paid");
    expect(normalizeChannel("organic")).toBe("organic");
    expect(normalizeChannel("social")).toBe("social");
    expect(normalizeChannel("partner")).toBe("partner");
    expect(normalizeChannel("campaign")).toBe("campaign");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(normalizeChannel("  Referral ")).toBe("referral");
    expect(normalizeChannel("PAID")).toBe("paid");
  });

  it("folds unknown or absent sources into 'other' (bounds cohort count)", () => {
    expect(normalizeChannel("some-random-code")).toBe("other");
    expect(normalizeChannel("")).toBe("other");
    expect(normalizeChannel(null)).toBe("other");
    expect(normalizeChannel(undefined)).toBe("other");
  });

  it("strips punctuation so an injected slug can't create a distinct channel", () => {
    // "referral" with stray punctuation still resolves to the known channel…
    expect(normalizeChannel("referral!!!")).toBe("referral");
    // …and a non-channel with punctuation still lands in 'other', never raw.
    expect(normalizeChannel("../../etc")).toBe("other");
  });
});
