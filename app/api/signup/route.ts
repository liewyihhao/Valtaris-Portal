import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, makeVerificationToken } from "@/lib/portal/password";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  country: z.string().min(1),
  primaryLanguage: z.string().min(1),
  consent: z.boolean().refine((v) => v === true, "Privacy Policy consent is required"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email, password, country, primaryLanguage } = parsed.data;
  const normalized = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email: normalized,
      passwordHash,
      country,
      primaryLanguage,
      role: "applicant",
      applicationStage: "eligibility",
    },
  });

  // No mail provider in the MVP: return a dev verification link the UI surfaces.
  const token = makeVerificationToken(normalized);
  const verifyUrl = `/api/verify?email=${encodeURIComponent(normalized)}&token=${token}`;

  return NextResponse.json({ ok: true, verifyUrl });
}
