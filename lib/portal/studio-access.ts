import { prisma } from "@/lib/db";
import { signJwt } from "./jwt";
import { writeAudit } from "./audit";
import { requiresIdBiometric } from "./kyc";
import type { Tier } from "./constants";

// ---------------------------------------------------------------------------
// STUDIO ACCESS FEDERATION
//
// The Portal is the single identity provider. Valtaris Studio (Label Studio
// fork) trusts a short-lived signed token this Portal mints — only for users
// who pass the eligibility gate below. A failed exam leaves no active
// qualification, so `eligible` is false and no token is ever issued.
// Access model is all-or-nothing (any active qualification unlocks Studio);
// project visibility is scoped by the instance/project invite.
// ---------------------------------------------------------------------------

export type EligibilityResult = { eligible: boolean; reasons: string[] };

export async function studioEligible(userId: string): Promise<EligibilityResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      qualifications: true,
      agreements: true,
      taxProfile: true,
      trustProfile: true,
    },
  });
  const reasons: string[] = [];
  if (!user) return { eligible: false, reasons: ["no_user"] };

  if (user.status !== "active") reasons.push(`account_${user.status}`);
  if (user.applicationStage !== "approved") reasons.push("not_approved");

  // The exam gate: at least one active qualification at a passing tier.
  const active = user.qualifications.filter((q) => q.status === "active" && q.tier !== "T0_trainee");
  if (active.length === 0) reasons.push("no_passed_qualification");

  // Recert: any active qualification past its recert-due date lapses access.
  const now = new Date();
  if (active.some((q) => q.recertDueAt && q.recertDueAt < now)) reasons.push("recert_lapsed");

  // Agreements + tax complete.
  const hasContract = user.agreements.some((a) => a.type === "contractor");
  const hasTax = !!user.taxProfile?.completedAt || user.agreements.some((a) => a.type === "tax_w9" || a.type === "tax_w8ben");
  if (!hasContract) reasons.push("agreements_incomplete");
  if (!hasTax) reasons.push("tax_incomplete");

  // KYC valid for the highest tier held (ID+biometric for T3).
  const highest = highestTier(active.map((q) => q.tier as Tier));
  if (highest && requiresIdBiometric(highest) && user.trustProfile?.kycLevel !== "id_biometric") {
    reasons.push("kyc_insufficient_for_tier");
  }
  if (user.trustProfile?.sanctionsStatus === "flagged") reasons.push("sanctions_flagged");

  return { eligible: reasons.length === 0, reasons };
}

function highestTier(tiers: Tier[]): Tier | null {
  const order: Tier[] = ["T0_trainee", "T1_associate", "T2_skilled", "T3_specialist"];
  return tiers.reduce<Tier | null>((h, t) => (h == null || order.indexOf(t) > order.indexOf(h) ? t : h), null);
}

// Mint the short-lived SSO token (2-minute TTL, single-use jti).
export function mintStudioToken(params: { userId: string; email: string; lsUserId?: string | null }): string {
  const secret = process.env.STUDIO_SSO_SECRET;
  if (!secret) throw new Error("STUDIO_SSO_SECRET not configured");
  const exp = Math.floor(Date.now() / 1000) + 120;
  return signJwt({ sub: params.userId, email: params.email, lsUserId: params.lsUserId ?? null, exp }, secret);
}

export function studioLoginUrl(token: string, labelStudioProjectId?: string | null): string {
  const base = process.env.LABEL_STUDIO_BASE_URL ?? "http://localhost:8080";
  const proj = labelStudioProjectId ? `&project=${encodeURIComponent(labelStudioProjectId)}` : "";
  // `project` deep-links Studio to that project's data after SSO login (Studio
  // only grants access to projects that have data uploaded from the Portal).
  return `${base}/sso/login?token=${encodeURIComponent(token)}${proj}`;
}

// Block or restore Studio access. Called by suspend/recert/fraud/compliance
// flows. When Label Studio is configured, also flips the Django user is_active.
export async function setStudioAccess(userId: string, status: "active" | "blocked" | "suspended", reason?: string | null) {
  const account = await prisma.labelStudioAccount.findUnique({ where: { userId } });
  if (!account) return;
  const active = status === "active";
  await prisma.labelStudioAccount.update({
    where: { userId },
    data: {
      studioAccessStatus: status,
      lsUserActive: active,
      revokedReason: active ? null : reason ?? null,
      revokedAt: active ? null : new Date(),
    },
  });
  await writeAudit({
    entityType: "LabelStudioAccount",
    entityId: account.id,
    action: active ? "studio_access_restored" : "studio_access_revoked",
    after: { status, reason: reason ?? null },
  });

  // Best-effort: push the active/inactive flag to the Studio fork so an already
  // logged-in session is revoked, not just future SSO mints. Never throws — a
  // Studio outage must not roll back the Portal-side revocation, which is
  // authoritative; the nightly reconcile + Studio's own standing re-check are
  // the backstop.
  await pushStudioActiveToFork(userId, active);
}

// Calls the Studio fork's secret-gated set-active endpoint (valtaris_sso app).
// No-ops when Studio isn't configured (base URL / SSO secret unset).
export async function pushStudioActiveToFork(userId: string, active: boolean): Promise<{ pushed: boolean }> {
  const base = process.env.LABEL_STUDIO_BASE_URL;
  const secret = process.env.STUDIO_SSO_SECRET;
  if (!base || !secret) return { pushed: false };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`${base}/api/valtaris/set-active`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Valtaris-Secret": secret },
      body: JSON.stringify({ valtaris_user_id: userId, active }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { pushed: true };
  } catch {
    return { pushed: false }; // best-effort; Portal state already updated + audited
  }
}
