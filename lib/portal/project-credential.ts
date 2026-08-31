import crypto from "crypto";

// ---------------------------------------------------------------------------
// PER-PROJECT CREDENTIALS.
// A worker who accepts a project gets a project-scoped login (unique username +
// their own password), set up via a verification email — separate from their
// main account, used to enter that project's workspace. Top level is prisma-free
// so the pure helpers stay unit-testable.
// ---------------------------------------------------------------------------

function slug(s: string, n = 12): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, n) || "user";
}

/** Unique-ish project username, e.g. "siti-acme-a3f9". Pure. */
export function generateUsername(fullName: string | null | undefined, clientName: string): string {
  const first = slug((fullName ?? "user").split(/\s+/)[0] ?? "user", 12);
  const client = slug(clientName, 10);
  return `${first}-${client}-${crypto.randomBytes(2).toString("hex")}`;
}

function hmac(input: string): string {
  return crypto.createHmac("sha256", process.env.AUTH_SECRET ?? "dev-secret").update(input).digest("hex");
}

/** Token for the emailed project-setup link. Pure. */
export function projectCredToken(credId: string): string {
  return hmac(`projcred:${credId}`);
}
export function verifyProjectCredToken(credId: string, token: string): boolean {
  const a = Buffer.from(projectCredToken(credId));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Signed value for the per-project "unlocked this session" cookie. Pure. */
export function projectAccessCookie(userId: string, batchId: string): string {
  return hmac(`pacc:${userId}:${batchId}`);
}

export function setupUrlFor(credId: string): string {
  return `/project-setup?cred=${credId}&token=${projectCredToken(credId)}`;
}

/** Create (or reuse) a pending project credential; returns the setup link. */
export async function createProjectCredential(userId: string, taskBatchId: string) {
  const { prisma } = await import("@/lib/db");
  const existing = await prisma.projectCredential.findUnique({ where: { userId_taskBatchId: { userId, taskBatchId } } });
  if (existing) return { cred: existing, setupUrl: setupUrlFor(existing.id), created: false };

  const [batch, user] = await Promise.all([
    prisma.taskBatch.findUnique({ where: { id: taskBatchId }, select: { clientName: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
  ]);
  const username = generateUsername(user?.fullName, batch?.clientName ?? "project");
  const cred = await prisma.projectCredential.create({ data: { userId, taskBatchId, username, status: "pending" } });
  return { cred, setupUrl: setupUrlFor(cred.id), created: true };
}

/** Complete setup: verify the emailed token, set the project password. */
export async function completeProjectCredential(credId: string, token: string, password: string) {
  const { prisma } = await import("@/lib/db");
  const { hashPassword } = await import("./password");
  if (!verifyProjectCredToken(credId, token)) return { ok: false as const, error: "This setup link is invalid or expired." };
  const cred = await prisma.projectCredential.findUnique({ where: { id: credId } });
  if (!cred) return { ok: false as const, error: "Credential not found." };
  if (cred.verifiedAt) return { ok: false as const, error: "This project login is already set up." };
  await prisma.projectCredential.update({
    where: { id: credId },
    data: { passwordHash: await hashPassword(password), verifiedAt: new Date(), status: "active" },
  });
  return { ok: true as const, username: cred.username };
}
