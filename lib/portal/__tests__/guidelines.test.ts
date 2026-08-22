import { describe, it, expect } from "vitest";
import { nextGuidelineVersion, recertModuleTitle, isRecertModule } from "../guidelines";

describe("guideline versioning helpers (§2.2/§2.3)", () => {
  it("starts at v1 when no version exists yet", () => {
    expect(nextGuidelineVersion(null)).toBe(1);
    expect(nextGuidelineVersion(undefined)).toBe(1);
  });

  it("increments from the current max", () => {
    expect(nextGuidelineVersion(1)).toBe(2);
    expect(nextGuidelineVersion(7)).toBe(8);
  });

  it("builds a deterministic recert-module title (used as the dedupe key)", () => {
    expect(recertModuleTitle("Text & NLP", 3)).toBe("Recert: What changed — Text & NLP guidelines v3");
    // Same inputs → same title, so a re-published version won't duplicate the module.
    expect(recertModuleTitle("Image", 2)).toBe(recertModuleTitle("Image", 2));
  });

  it("recognizes recert modules by title, and ordinary courses are not recert", () => {
    expect(isRecertModule(recertModuleTitle("Audio / Speech", 5))).toBe(true);
    expect(isRecertModule("Valtaris Basics")).toBe(false);
    expect(isRecertModule("Text & NLP foundations")).toBe(false);
  });
});
