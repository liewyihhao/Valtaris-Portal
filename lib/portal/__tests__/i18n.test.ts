import { describe, it, expect } from "vitest";
import { t, localeForLanguage, DEFAULT_LOCALE } from "../i18n";

describe("i18n content layer (§6 groundwork)", () => {
  it("returns the English template for a known key", () => {
    expect(t("notif.appeal.upheld.title")).toBe("Your appeal was upheld");
  });

  it("interpolates {placeholders} from vars", () => {
    expect(t("notif.exam.pass.title", { track: "Text / NLP" })).toBe(
      "You passed the Text / NLP certification exam"
    );
    expect(t("notif.guideline.update.title", { track: "Image", version: 3 })).toBe(
      "Guideline update — Image v3"
    );
  });

  it("coerces numeric vars and leaves unknown placeholders visible", () => {
    expect(t("notif.exam.fail.title", { track: "Audio" })).toBe("Audio exam — not passed this time");
    // A body needing {score} but not given it keeps the placeholder rather than blanking.
    expect(t("notif.exam.fail.body", { track: "Audio" })).toContain("{score}");
  });

  it("supports empty-string interpolation (optional detail)", () => {
    const body = t("notif.correction.requested.body", { detail: "", hours: 48 });
    expect(body).toContain("48 hours");
    expect(body).not.toContain("{detail}");
  });

  it("only English is supported today; languages fall back to the default locale", () => {
    expect(localeForLanguage("Spanish")).toBe(DEFAULT_LOCALE);
    expect(localeForLanguage(null)).toBe(DEFAULT_LOCALE);
  });
});
