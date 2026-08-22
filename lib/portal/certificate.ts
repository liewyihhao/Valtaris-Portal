// ---------------------------------------------------------------------------
// CERTIFICATES + PUBLIC VERIFICATION (master design §2.3/§4).
//
// A Certificate is a verifiable credential issued when a qualification tier is
// earned. The live Qualification stays the source of truth: verification
// cross-checks it, so a suspended/revoked/down-tiered qualification reads as
// "not currently valid" even though the certificate row still exists. Issuance
// is a side effect of the scoring service (the only tier writer) — never
// self-served. Top level is prisma-free so the pure helper stays unit-testable.
// ---------------------------------------------------------------------------

export type CertificateValidity = { valid: boolean; reason: string };

/**
 * Whether a certificate is currently valid, given the live qualification it was
 * issued against. Pure — unit-testable. Order of checks is deliberate: an
 * explicit revocation wins, then the qualification must be active and still at
 * (or above) the certified tier.
 */
export function certificateStatus(input: {
  revokedAt: Date | null;
  certTier: string;
  qualStatus: string | null;
  qualTier: string | null;
}): CertificateValidity {
  if (input.revokedAt) return { valid: false, reason: "revoked" };
  if (!input.qualStatus) return { valid: false, reason: "no_qualification" };
  if (input.qualStatus !== "active") return { valid: false, reason: `qualification_${input.qualStatus}` };
  if (input.qualTier !== input.certTier) return { valid: false, reason: "tier_changed" };
  return { valid: true, reason: "valid" };
}

/** A readable, unique-enough public serial, e.g. VAL-3F9A2C7B-D41E. */
export function makeSerial(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();
  return `VAL-${hex(8)}-${hex(4)}`;
}

/**
 * Issue (or refresh) the single certificate for a (user, track). Called from
 * the qualification scoring service on a pass. Keeps a stable serial across
 * re-issues so a shared/printed link never breaks; refreshes tier + issuedAt
 * and clears any prior revocation.
 */
export async function issueCertificate(params: {
  userId: string;
  trackId: string;
  tier: string;
  sourceQualificationId?: string | null;
}) {
  const { prisma } = await import("@/lib/db");
  const { writeAudit } = await import("./audit");

  const existing = await prisma.certificate.findUnique({
    where: { userId_trackId: { userId: params.userId, trackId: params.trackId } },
  });
  const serial = existing?.serial ?? makeSerial();

  const cert = await prisma.certificate.upsert({
    where: { userId_trackId: { userId: params.userId, trackId: params.trackId } },
    create: {
      userId: params.userId,
      trackId: params.trackId,
      tier: params.tier,
      serial,
      sourceQualificationId: params.sourceQualificationId ?? null,
    },
    update: {
      tier: params.tier,
      issuedAt: new Date(),
      revokedAt: null,
      sourceQualificationId: params.sourceQualificationId ?? null,
    },
  });

  await writeAudit({
    entityType: "Certificate",
    entityId: cert.id,
    action: existing ? "certificate_reissued" : "certificate_issued",
    after: { serial: cert.serial, tier: cert.tier },
  });
  return cert;
}

export type CertificateVerification =
  | { found: false }
  | {
      found: true;
      valid: boolean;
      reason: string;
      holderName: string;
      trackName: string;
      tier: string;
      issuedAt: Date;
      serial: string;
    };

/**
 * Public verification by serial. Returns only non-sensitive fields (holder
 * display name, track, tier, issue date, validity) — never contact details.
 */
export async function verifyCertificate(serial: string): Promise<CertificateVerification> {
  const { prisma } = await import("@/lib/db");
  const cert = await prisma.certificate.findUnique({
    where: { serial },
    include: { user: { select: { id: true, fullName: true, email: true } }, track: { select: { name: true } } },
  });
  if (!cert) return { found: false };

  const qual = await prisma.qualification.findUnique({
    where: { userId_trackId: { userId: cert.userId, trackId: cert.trackId } },
    select: { status: true, tier: true },
  });
  const status = certificateStatus({
    revokedAt: cert.revokedAt,
    certTier: cert.tier,
    qualStatus: qual?.status ?? null,
    qualTier: qual?.tier ?? null,
  });

  // Display name only — fall back to a masked email local-part, never the full
  // address (public endpoint).
  const holderName = cert.user.fullName ?? cert.user.email.split("@")[0];

  return {
    found: true,
    valid: status.valid,
    reason: status.reason,
    holderName,
    trackName: cert.track.name,
    tier: cert.tier,
    issuedAt: cert.issuedAt,
    serial: cert.serial,
  };
}
