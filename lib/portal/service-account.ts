import { createHash, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// SERVICE-ACCOUNT AUTH for system-to-system calls (master design §9).
//
// The future Label Studio bridge authenticates with a scoped API key, not a
// user session. We store only sha256(key) — the raw key is shown once at
// creation and never again. Scopes gate each integration endpoint. Top level
// uses only node crypto (no prisma), so the pure helpers stay unit-testable;
// DB access is lazily imported.
// ---------------------------------------------------------------------------

export const SERVICE_SCOPES = ["worksummary:write", "standing:read"] as const;
export type ServiceScope = (typeof SERVICE_SCOPES)[number];

export const KEY_PREFIX = "vlt_"; // human-recognizable key prefix

/** Generate a raw API key. Shown once; only its hash is stored. */
export function generateKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

/** sha256 of a raw key — what we persist and look up by. Deterministic. */
export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** A short, non-secret identifier for display (never enough to authenticate). */
export function keyPrefixFor(rawKey: string): string {
  return rawKey.slice(0, KEY_PREFIX.length + 6);
}

export function parseScopes(csv: string): string[] {
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Whether a granted scope set includes the required scope. Pure. */
export function hasScope(grantedCsv: string, required: ServiceScope): boolean {
  return parseScopes(grantedCsv).includes(required);
}

/** Validate a requested scope list against the known set. Pure. */
export function sanitizeScopes(requested: string[]): ServiceScope[] {
  const known = new Set<string>(SERVICE_SCOPES);
  return requested.filter((s): s is ServiceScope => known.has(s));
}

/** Extract the bearer/api-key value from a request's headers. */
export function extractKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const apiKey = req.headers.get("x-api-key");
  return apiKey?.trim() || null;
}

export type AuthResult =
  | { ok: true; account: { id: string; name: string; scopes: string } }
  | { ok: false; status: number; error: string };

/**
 * Authenticate a service-to-service request and check a required scope.
 * Returns 401 when the key is missing/invalid/revoked, 403 when the key is
 * valid but lacks the scope. Touches lastUsedAt on success.
 */
export async function authenticateServiceAccount(req: Request, required: ServiceScope): Promise<AuthResult> {
  const raw = extractKey(req);
  if (!raw) return { ok: false, status: 401, error: "Missing API key (Authorization: Bearer <key> or X-Api-Key)." };

  const { prisma } = await import("@/lib/db");
  const account = await prisma.serviceAccount.findUnique({ where: { keyHash: hashKey(raw) } });
  if (!account || account.revokedAt) return { ok: false, status: 401, error: "Invalid or revoked API key." };

  if (!hasScope(account.scopes, required)) {
    return { ok: false, status: 403, error: `API key lacks required scope "${required}".` };
  }

  await prisma.serviceAccount.update({ where: { id: account.id }, data: { lastUsedAt: new Date() } });
  return { ok: true, account: { id: account.id, name: account.name, scopes: account.scopes } };
}

/** Create a service account, returning the RAW key once (never stored raw). */
export async function createServiceAccount(params: {
  name: string;
  description?: string | null;
  scopes: ServiceScope[];
  createdById?: string | null;
}) {
  const { prisma } = await import("@/lib/db");
  const { writeAudit } = await import("./audit");
  const rawKey = generateKey();
  const account = await prisma.serviceAccount.create({
    data: {
      name: params.name,
      description: params.description ?? null,
      scopes: params.scopes.join(","),
      keyHash: hashKey(rawKey),
      keyPrefix: keyPrefixFor(rawKey),
      createdById: params.createdById ?? null,
    },
  });
  await writeAudit({
    entityType: "ServiceAccount",
    entityId: account.id,
    action: "service_account_created",
    actorId: params.createdById ?? null,
    after: { name: account.name, scopes: account.scopes },
  });
  return { account, rawKey };
}

/** Revoke a service account (adverse, audited). Idempotent. */
export async function revokeServiceAccount(id: string, actorId?: string | null) {
  const { prisma } = await import("@/lib/db");
  const { writeAudit } = await import("./audit");
  await prisma.serviceAccount.update({ where: { id }, data: { revokedAt: new Date() } });
  await writeAudit({ entityType: "ServiceAccount", entityId: id, action: "service_account_revoked", actorId: actorId ?? null });
}
