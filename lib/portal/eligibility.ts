import { RESTRICTED_REGIONS } from "./options";

// Fast pass/fail gate: age, region, device. Region check is a stub against a
// small restricted list — a real deployment wires sanctions/denied-party
// screening here (see lib/portal/screening.ts).
export function evaluateEligibility(input: {
  ageConfirmed: boolean;
  region: string;
  deviceType: string;
}): { passed: boolean; reason?: string } {
  if (!input.ageConfirmed) {
    return { passed: false, reason: "You must be 18 or older to work with Valtaris." };
  }
  if (RESTRICTED_REGIONS.includes(input.region)) {
    return {
      passed: false,
      reason: `Valtaris isn't currently able to work with applicants in ${input.region} due to sanctions/export rules.`,
    };
  }
  return { passed: true };
}
