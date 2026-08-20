// Compare a submitted Label Studio annotation `result` against the task's
// ground_truth annotation `result` (the answer key). Per the integration spec
// Section 5/9, pass/fail scoring is computed in Valtaris, not Label Studio CE.
//
// LS `result` is an array of regions; for the classification/choice exam items
// we compare the set of chosen values. This is intentionally lenient about
// region ids/order and strict about the chosen labels.

type LsRegion = { value?: Record<string, unknown>; from_name?: string; type?: string };

function chosenValues(result: unknown): string[] {
  if (!Array.isArray(result)) return [];
  const out: string[] = [];
  for (const region of result as LsRegion[]) {
    const v = region?.value;
    if (!v) continue;
    for (const key of ["choices", "labels", "taxonomy"]) {
      const arr = v[key];
      if (Array.isArray(arr)) out.push(...arr.map((x) => String(x)));
    }
    if (typeof v.text === "string") out.push(v.text);
    if (typeof v.rating === "number") out.push(`rating:${v.rating}`);
  }
  return out.map((s) => s.trim().toLowerCase()).sort();
}

/** True when the submitted result matches the ground-truth answer key. */
export function resultMatches(submitted: unknown, groundTruth: unknown): boolean {
  const a = chosenValues(submitted);
  const b = chosenValues(groundTruth);
  if (b.length === 0) return false; // no answer key → cannot auto-pass
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
