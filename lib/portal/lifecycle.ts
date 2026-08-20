import { prisma } from "@/lib/db";
import { writeAudit } from "./audit";
import { sendEmail } from "./email";
import { DORMANCY_WARN_MONTHS, DORMANCY_PURGE_MONTHS } from "./constants";

// Applicant data lifecycle: active → dormant (warned at 11mo) → purged (12mo).
// Paid workers are excluded — their financial/tax records are under legal hold.

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

/** 11 months idle → send the re-engagement email, mark dormant. */
export async function runDormancyWarnings() {
  const cutoff = monthsAgo(DORMANCY_WARN_MONTHS);
  const candidates = await prisma.user.findMany({
    where: {
      role: "applicant", // never paid → no legal-hold records
      status: "active",
      dormantNotifiedAt: null,
      lastActiveAt: { lt: cutoff },
    },
  });

  for (const u of candidates) {
    await sendEmail({
      to: u.email,
      subject: "Your Valtaris application is about to be removed",
      body: `Hi,\n\nWe noticed you haven't been active for a while. To keep your Valtaris application, please log in within the next month — otherwise your account and data will be removed.\n\nLog in: /login`,
    });
    await prisma.user.update({ where: { id: u.id }, data: { status: "dormant", dormantNotifiedAt: new Date() } });
    await writeAudit({ entityType: "User", entityId: u.id, action: "dormancy_warned", after: { status: "dormant" } });
  }
  return candidates.length;
}

/** 12 months idle → delete/anonymize PII (keep a hashed anti-fraud fingerprint). */
export async function runDormancyPurge() {
  const cutoff = monthsAgo(DORMANCY_PURGE_MONTHS);
  const candidates = await prisma.user.findMany({
    where: { role: "applicant", status: "dormant", lastActiveAt: { lt: cutoff } },
  });

  for (const u of candidates) {
    // Minimal anti-fraud fingerprint (hashed) is retained; PII is stripped.
    const fingerprint = hashEmail(u.email);
    await prisma.$transaction([
      prisma.questionnaireResponse.deleteMany({ where: { userId: u.id } }),
      prisma.eligibilityCheck.deleteMany({ where: { userId: u.id } }),
      prisma.annotatorLanguage.deleteMany({ where: { userId: u.id } }),
      prisma.user.update({
        where: { id: u.id },
        data: {
          status: "purged",
          email: `purged+${fingerprint}@valtaris.invalid`,
          fullName: null,
          phone: null,
          passwordHash: "",
          country: "REDACTED",
          primaryLanguage: "REDACTED",
        },
      }),
    ]);
    await writeAudit({ entityType: "User", entityId: u.id, action: "purged_pii", after: { status: "purged", fingerprint } });
  }
  return candidates.length;
}

function hashEmail(email: string): string {
  // Lightweight, dependency-free fingerprint (not for security — dedup/anti-fraud only).
  let h = 0;
  const s = email.toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
