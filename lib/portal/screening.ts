// Pluggable sanctions / denied-party screening. Interface + a stub so a real
// provider can be wired later WITHOUT hardcoding "always pass". Run before a
// payout method is activated and before the first payout.

import { RESTRICTED_REGIONS } from "./options";
import { SANCTIONS_RESCREEN_DAYS } from "./constants";

/**
 * Whether a trust profile is due for sanctions re-screening. Never-screened
 * (null) is always due; otherwise due once the cadence window has elapsed.
 * Pure — unit-testable without a DB.
 */
export function needsRescreen(
  sanctionsCheckedAt: Date | null | undefined,
  now: Date = new Date(),
  days: number = SANCTIONS_RESCREEN_DAYS
): boolean {
  if (!sanctionsCheckedAt) return true;
  return now.getTime() - sanctionsCheckedAt.getTime() >= days * 24 * 3600 * 1000;
}

export interface ScreeningProvider {
  screen(input: { fullName?: string | null; country: string }): Promise<{
    cleared: boolean;
    matchDetail?: string;
  }>;
}

// Stub implementation: clears everyone except restricted regions. This is
// intentionally NOT "always pass" — swap for a real provider in production.
export const stubScreeningProvider: ScreeningProvider = {
  async screen({ country }) {
    if (RESTRICTED_REGIONS.includes(country)) {
      return { cleared: false, matchDetail: `Restricted region: ${country}` };
    }
    return { cleared: true };
  },
};

export function getScreeningProvider(): ScreeningProvider {
  // TODO: wire a real sanctions-screening provider here.
  return stubScreeningProvider;
}
