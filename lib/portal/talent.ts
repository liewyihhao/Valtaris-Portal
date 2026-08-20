import type { Prisma } from "@prisma/client";
import type { Tier } from "./constants";

// Tier ordering for "minimum tier" filters.
const TIER_ORDER: Tier[] = ["T0_trainee", "T1_associate", "T2_skilled", "T3_specialist"];

export function tiersAtOrAbove(min: Tier): Tier[] {
  const i = TIER_ORDER.indexOf(min);
  return i < 0 ? TIER_ORDER : TIER_ORDER.slice(i);
}

export type TalentFilters = {
  q?: string; // email / name contains
  trackId?: string;
  minTier?: Tier;
  language?: string;
  country?: string;
  surgeOnly?: boolean;
  kycLevel?: string;
  status?: string; // active | dormant | suspended
  minAccuracy?: number; // 0..1 rolling accuracy
};

/**
 * Build a Prisma `where` for the annotator talent pool from admin filters.
 * All conditions AND together; each is skipped when unset.
 */
export function buildTalentWhere(f: TalentFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: "annotator" };
  const and: Prisma.UserWhereInput[] = [];

  if (f.q) and.push({ OR: [{ email: { contains: f.q } }, { fullName: { contains: f.q } }] });
  if (f.status) where.status = f.status;
  if (f.country) where.country = f.country;

  if (f.trackId || f.minTier) {
    and.push({
      qualifications: {
        some: {
          status: "active",
          ...(f.trackId ? { trackId: f.trackId } : {}),
          ...(f.minTier ? { tier: { in: tiersAtOrAbove(f.minTier) } } : {}),
        },
      },
    });
  }
  if (f.language) and.push({ annotatorLanguages: { some: { language: f.language } } });
  if (f.surgeOnly) and.push({ availability: { is: { surgeOptIn: true } } });
  if (f.kycLevel) and.push({ trustProfile: { is: { kycLevel: f.kycLevel } } });
  if (typeof f.minAccuracy === "number") {
    and.push({ performanceMetrics: { some: { rollingAccuracy: { gte: f.minAccuracy } } } });
  }

  if (and.length) where.AND = and;
  return where;
}

// Fields the talent list + drill-down need, in one include.
export const talentInclude = {
  qualifications: { include: { track: true } },
  annotatorLanguages: true,
  availability: true,
  trustProfile: true,
  taxProfile: true,
  performanceMetrics: { include: { track: true } },
} satisfies Prisma.UserInclude;
