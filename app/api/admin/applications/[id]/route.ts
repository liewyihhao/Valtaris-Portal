import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";
import { hashPassword, makeVerificationToken } from "@/lib/portal/password";
import { sendEmail } from "@/lib/portal/email";

const schema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).optional() });

// Admin decision on a Website-sourced application.
//  - approve → create a pending applicant account (no password yet), email an
//    invite link to set their password + finish signing up, mark application
//    "invited".
//  - reject  → mark "rejected" and email a decline notice.
// Email is a dev stub (logs); the invite link is also returned so it can be
// used/copied while no real mail provider is wired.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user: staff } = await requireCapability("recruiter");
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const app = await prisma.contributorApplication.findUnique({ where: { id }, include: { languages: true } });
  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (app.status === "invited" || app.status === "rejected") {
    return NextResponse.json({ error: `This application is already ${app.status}.` }, { status: 409 });
  }

  const email = app.email.toLowerCase();

  if (parsed.data.action === "reject") {
    await prisma.contributorApplication.update({ where: { id }, data: { status: "rejected" } });
    await writeAudit({ entityType: "ContributorApplication", entityId: id, action: "application_rejected", actorId: staff.id });
    await sendEmail({
      to: email,
      subject: "Update on your Valtaris application",
      body: `Hi ${app.fullName},\n\nThank you for applying to the Valtaris Contributor Network. After review, we're unable to move forward with your application at this time.\n\nWe appreciate your interest and wish you the best.\n\n— The Valtaris Team`,
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // approve — don't create a duplicate account.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A Portal account with this email already exists." }, { status: 409 });
  }

  const strongest = app.languages.find((l) => l.isStrongest) ?? app.languages[0];
  // Placeholder password — unusable until the invite sets a real one.
  const placeholder = await hashPassword(crypto.randomBytes(24).toString("hex"));
  await prisma.user.create({
    data: {
      email,
      passwordHash: placeholder,
      role: "applicant",
      fullName: app.fullName,
      country: app.country ?? "Unknown",
      primaryLanguage: strongest?.languageName ?? "English",
      applicationStage: "eligibility",
      status: "active",
      emailVerifiedAt: null, // set when they complete the invite
    },
  });

  await prisma.contributorApplication.update({ where: { id }, data: { status: "invited" } });
  await writeAudit({ entityType: "ContributorApplication", entityId: id, action: "application_approved", actorId: staff.id, after: { email } });

  const token = makeVerificationToken(email);
  const inviteUrl = `/invite?email=${encodeURIComponent(email)}&token=${token}`;
  await sendEmail({
    to: email,
    subject: "You're approved — set up your Valtaris account",
    body: `Hi ${app.fullName},\n\nGreat news — your application to the Valtaris Contributor Network was approved!\n\nClick the link below to verify your email and set your password:\n${inviteUrl}\n\nWelcome aboard.\n\n— The Valtaris Team`,
  });

  return NextResponse.json({ ok: true, status: "invited", inviteUrl });
}
