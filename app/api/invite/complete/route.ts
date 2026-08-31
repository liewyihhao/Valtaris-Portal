import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyVerificationToken } from "@/lib/portal/password";

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1).max(120).optional(),
});

// Applicant completes their invited account: verify the emailed token, set a
// password + display name, and mark the email verified. After this they can log in.
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  if (!verifyVerificationToken(email, parsed.data.token)) {
    return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 400 });
  }

  // Only a pending (unverified) invited account can be completed.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "No pending invitation for this email." }, { status: 404 });
  if (user.emailVerifiedAt) {
    return NextResponse.json({ error: "This account is already set up — please log in." }, { status: 409 });
  }

  await prisma.user.update({
    where: { email },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      emailVerifiedAt: new Date(),
      fullName: parsed.data.fullName ?? user.fullName,
      lastActiveAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
