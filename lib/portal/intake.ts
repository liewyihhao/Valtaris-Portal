// ---------------------------------------------------------------------------
// INTAKE COHORT TAGGING (recruitment analytics — master design §2.7)
//
// Applicants arrive via a signup link that may carry a referral/source code
// (`?ref=`). Tagging each applicant into an intake Cohort at application time is
// what later makes funnel/channel questions answerable ("referral vs paid",
// "how did the Aug LATAM push convert"). Nothing here is a trust boundary — an
// intake tag never affects tier, pay, or standing; it is pure provenance.
// ---------------------------------------------------------------------------

// Known acquisition channels. An unrecognized `ref` folds into "other" so the
// cohort count stays bounded (channels × regions × months) and a stranger can't
// spam arbitrary cohorts into existence by varying the query string.
const KNOWN_CHANNELS = ["referral", "paid", "organic", "social", "partner", "campaign"] as const;
export type Channel = (typeof KNOWN_CHANNELS)[number] | "other";

const CHANNEL_LABEL: Record<Channel, string> = {
  referral: "Referral",
  paid: "Paid",
  organic: "Organic",
  social: "Social",
  partner: "Partner",
  campaign: "Campaign",
  other: "Other",
};

/** Map a raw `ref` value to a bounded, known channel. Pure — unit-testable. */
export function normalizeChannel(raw: string | null | undefined): Channel {
  if (!raw) return "other";
  const slug = raw.toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
  return (KNOWN_CHANNELS as readonly string[]).includes(slug) ? (slug as Channel) : "other";
}

/** First day of `d`'s month, and the label `YYYY-MM`, in UTC. */
function monthWindow(d = new Date()): { start: Date; end: Date; label: string } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, label };
}

type Db = typeof import("@/lib/db")["prisma"];

/** A stable owner for auto-created intake cohorts: a recruiter, else an admin. */
async function systemActorId(prisma: Db): Promise<string | null> {
  const recruiter = await prisma.internalCapability.findFirst({
    where: { capability: "recruiter" },
    select: { userId: true },
  });
  if (recruiter) return recruiter.userId;
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  return admin?.id ?? null;
}

/**
 * Resolve the intake Cohort an applicant should be tagged into, creating a
 * rolling monthly cohort per (channel, region) when needed. Returns the cohort
 * id or null (never throws — a tagging failure must never block signup).
 *
 * `ref` may be an existing intake-cohort id (a recruiter's per-campaign link),
 * which is used directly; otherwise it is treated as a channel slug.
 */
export async function resolveIntakeCohortId(params: {
  ref?: string | null;
  region?: string | null;
}): Promise<string | null> {
  try {
    // Lazy import keeps this module's top level prisma-free so the pure helpers
    // (normalizeChannel) stay unit-testable without a DB/alias in the runner.
    const { prisma } = await import("@/lib/db");
    const ref = params.ref?.trim();
    const region = params.region?.trim() || null;

    // 1) A recruiter shared a specific intake-cohort link (?ref=<cohortId>).
    if (ref) {
      const direct = await prisma.cohort.findFirst({
        where: { id: ref, kind: "intake", status: { not: "archived" } },
        select: { id: true },
      });
      if (direct) return direct.id;
    }

    // 2) Otherwise group by channel + region + month.
    const channel = normalizeChannel(ref);
    const { start, end, label } = monthWindow();
    const name = `${CHANNEL_LABEL[channel]}${region ? ` · ${region}` : ""} · ${label}`;

    const existing = await prisma.cohort.findFirst({
      where: { kind: "intake", name },
      select: { id: true },
    });
    if (existing) return existing.id;

    const createdById = await systemActorId(prisma);
    if (!createdById) return null; // no valid owner (unseeded env) — skip tagging

    const created = await prisma.cohort.create({
      data: {
        name,
        kind: "intake",
        source: channel,
        region,
        intakeStartDate: start,
        intakeEndDate: end,
        status: "open",
        createdById,
      },
      select: { id: true },
    });
    return created.id;
  } catch {
    // Provenance tagging is best-effort; never let it break account creation.
    return null;
  }
}
