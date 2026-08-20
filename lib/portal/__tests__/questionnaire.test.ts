import { describe, it, expect } from "vitest";
import {
  computeCalibrationScore,
  routeTestTrack,
  isSelfReportMismatch,
  routeQuestionnaire,
} from "../questionnaire";

const keys = [
  { questionId: "q1", correctIndex: 3 },
  { questionId: "q2", correctIndex: 0 },
  { questionId: "q3", correctIndex: 1 },
  { questionId: "q4", correctIndex: null }, // free-text, excluded from auto score
];

describe("computeCalibrationScore", () => {
  it("scores only auto-gradable items", () => {
    const answers = [
      { questionId: "q1", selectedIndex: 3 },
      { questionId: "q2", selectedIndex: 0 },
      { questionId: "q3", selectedIndex: 2 }, // wrong
      { questionId: "q4", freeText: "because it follows the instruction" },
    ];
    // 2 of 3 gradable = 67
    expect(computeCalibrationScore(answers, keys)).toBe(67);
  });

  it("returns 0 when nothing gradable", () => {
    expect(computeCalibrationScore([], [{ questionId: "x", correctIndex: null }])).toBe(0);
  });
});

describe("routeTestTrack", () => {
  it("routes >=70 to standard", () => {
    expect(routeTestTrack(70)).toBe("standard");
    expect(routeTestTrack(95)).toBe("standard");
  });
  it("routes 40–69 to foundational", () => {
    expect(routeTestTrack(40)).toBe("foundational");
    expect(routeTestTrack(69)).toBe("foundational");
  });
  it("routes <40 to training then foundational", () => {
    expect(routeTestTrack(39)).toBe("training_then_foundational");
    expect(routeTestTrack(0)).toBe("training_then_foundational");
  });
});

describe("isSelfReportMismatch", () => {
  it("flags Extensive self-report with sub-40 calibration", () => {
    expect(isSelfReportMismatch("Extensive", 30)).toBe(true);
  });
  it("does not flag consistent self-report", () => {
    expect(isSelfReportMismatch("Extensive", 80)).toBe(false);
    expect(isSelfReportMismatch("Basic", 20)).toBe(false);
  });
});

describe("routeQuestionnaire (integration of the per-domain pass)", () => {
  it("produces score, track and mismatch per domain", () => {
    const result = routeQuestionnaire([
      {
        domain: "text_nlp",
        selfRating: "Extensive",
        answers: [
          { questionId: "q1", selectedIndex: 0 }, // wrong
          { questionId: "q2", selectedIndex: 1 }, // wrong
          { questionId: "q3", selectedIndex: 2 }, // wrong
        ],
        keys,
      },
      {
        domain: "image",
        selfRating: "Moderate",
        answers: [
          { questionId: "q1", selectedIndex: 3 },
          { questionId: "q2", selectedIndex: 0 },
          { questionId: "q3", selectedIndex: 1 },
        ],
        keys,
      },
    ]);

    expect(result[0]).toMatchObject({
      domain: "text_nlp",
      calibrationScore: 0,
      routedTrack: "training_then_foundational",
      mismatchFlag: true, // Extensive + 0%
    });
    expect(result[1]).toMatchObject({
      domain: "image",
      calibrationScore: 100,
      routedTrack: "standard",
      mismatchFlag: false,
    });
  });
});
