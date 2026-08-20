import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVerificationToken } from "@/lib/portal/password";

// Stateless email verification. In production this URL would arrive by email.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase();
  const token = searchParams.get("token");

  if (!email || !token || !verifyVerificationToken(email, token)) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  await prisma.user.updateMany({
    where: { email, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });

  return NextResponse.redirect(new URL("/login?verified=1", req.url));
}
