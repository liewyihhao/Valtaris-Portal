// Validator Calibration Exam — pre-graded review scenarios (a submitted
// annotation + the correct verdict). The candidate judges someone else's
// judgment. Reuses the same webhook-scored pattern one level up. Answer keys
// live server-side; the exam UI only ever sees the prompt + the annotator's label.

export type ReviewScenario = {
  id: string;
  item: string;
  submittedLabel: string;
  correctVerdict: "approve" | "reject";
  note: string; // shown after grading / for admin bank management
};

// A compact, domain-general bank (10 items → pass bar 85%). A real deployment
// maintains per-domain banks in /admin/questions.
export const VALIDATOR_SCENARIOS: ReviewScenario[] = [
  { id: "v1", item: "\"Great, another delayed shipment. Love it.\"", submittedLabel: "Negative", correctVerdict: "reject", note: "Correct is Sarcastic-Negative; plain Negative misses intent." },
  { id: "v2", item: "\"The update fixed nothing and broke my login.\"", submittedLabel: "Negative", correctVerdict: "approve", note: "Clearly negative — approve." },
  { id: "v3", item: "\"The venue was fine, nothing special.\"", submittedLabel: "Positive", correctVerdict: "reject", note: "Neutral, not positive." },
  { id: "v4", item: "Bounding box drawn tightly around the visible car.", submittedLabel: "Valid box", correctVerdict: "approve", note: "Tight box hugging edges — approve." },
  { id: "v5", item: "Two overlapping cars, one box drawn around both.", submittedLabel: "Valid box", correctVerdict: "reject", note: "Should be one box per car." },
  { id: "v6", item: "Prompt: write a haiku. Response: a limerick.", submittedLabel: "Follows instruction", correctVerdict: "reject", note: "Wrong form — does not follow." },
  { id: "v7", item: "Fluent answer that invents a fake citation.", submittedLabel: "High quality", correctVerdict: "reject", note: "Factual error — not high quality." },
  { id: "v8", item: "Occluded but clearly a bicycle, labelled Bicycle.", submittedLabel: "Bicycle", correctVerdict: "approve", note: "Correct despite occlusion." },
  { id: "v9", item: "Instruction: answer in French. Response in English, correct content.", submittedLabel: "Full marks", correctVerdict: "reject", note: "Wrong language — reduced." },
  { id: "v10", item: "Neutral news headline labelled Neutral.", submittedLabel: "Neutral", correctVerdict: "approve", note: "Correct." },
];

/** Score verdicts (by scenario id) against the answer key. */
export function scoreValidatorExam(answers: { id: string; verdict: "approve" | "reject" }[]): number {
  const key = new Map(VALIDATOR_SCENARIOS.map((s) => [s.id, s.correctVerdict]));
  if (answers.length === 0) return 0;
  let correct = 0;
  for (const a of answers) if (key.get(a.id) === a.verdict) correct += 1;
  return Math.round((correct / VALIDATOR_SCENARIOS.length) * 100);
}
