// ---------------------------------------------------------------------------
// REGIONAL LABOR-CLASSIFICATION CHECKLIST (master design §2.12).
//
// Contractor-vs-employee rules vary by country and change over time; at
// international scale this needs an owned, periodically-reviewed checklist per
// active recruiting country, escalated to legal for the stricter jurisdictions.
// This module SURFACES the requirement (a curated risk reference + a review
// cadence); the actual legal determination is out of scope for a product spec.
//
// Nothing here is a trust boundary — it drives an internal compliance view,
// never a worker's tier, pay, or access.
// ---------------------------------------------------------------------------

export type LaborRisk = "low" | "medium" | "high";

export type LaborClassification = {
  risk: LaborRisk;
  note: string;
};

// Curated starting reference. HIGH = jurisdictions with active/known
// contractor-misclassification exposure that warrant standing legal review;
// MEDIUM = review recommended; LOW = lower near-term exposure. This is a
// product-side prompt for legal review, not legal advice, and must be kept
// current by Compliance as rules evolve.
const CLASSIFICATION: Record<string, LaborClassification> = {
  // Stricter / actively-evolving jurisdictions.
  Spain: { risk: "high", note: "'Riders law' & strong contractor-reclassification enforcement — legal review before scaling." },
  France: { risk: "high", note: "Aggressive requalification case law for platform work — confirm contractor status with counsel." },
  Netherlands: { risk: "high", note: "DBA-law enforcement tightening — classification review recommended." },
  Germany: { risk: "high", note: "Scheinselbstständigkeit (bogus self-employment) exposure — legal review." },
  "United States": { risk: "high", note: "State-by-state ABC tests (e.g. CA); evolving DOL rule — review per state of residence." },
  Italy: { risk: "medium", note: "Platform-work protections expanding — periodic review." },
  "United Kingdom": { risk: "medium", note: "'Worker' status case law (limb (b)) — confirm classification." },
  Brazil: { risk: "medium", note: "Labor-court reclassification risk — periodic review." },
  India: { risk: "low", note: "Lower near-term reclassification exposure — standard contractor terms." },
  Philippines: { risk: "low", note: "Lower near-term exposure — standard contractor terms." },
  Kenya: { risk: "low", note: "Lower near-term exposure — standard contractor terms." },
  Mexico: { risk: "medium", note: "Outsourcing-reform (REPSE) context — periodic review." },
  Malaysia: { risk: "low", note: "Lower near-term exposure — standard contractor terms." },
  Nigeria: { risk: "low", note: "Lower near-term exposure — standard contractor terms." },
};

// Countries not in the curated list default to "review needed" rather than
// silently "low" — an unknown jurisdiction is a prompt to look, not a pass.
const DEFAULT_CLASSIFICATION: LaborClassification = {
  risk: "medium",
  note: "Not yet reviewed — add a classification determination for this country.",
};

/** Labor-classification risk for a country. Pure — unit-testable. */
export function laborRiskFor(country: string): LaborClassification {
  return CLASSIFICATION[country] ?? DEFAULT_CLASSIFICATION;
}

export const LABOR_RISK_INTENT: Record<LaborRisk, "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};
