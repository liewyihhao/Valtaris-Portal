import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Stateless email-verification token (HMAC of email) so we don't need a mail
// provider or an extra table for the MVP. Swap for a real emailed link later.
export function makeVerificationToken(email: string): string {
  const secret = process.env.AUTH_SECRET ?? "dev-secret";
  return crypto.createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}

export function verifyVerificationToken(email: string, token: string): boolean {
  const expected = makeVerificationToken(email);
  // Constant-time compare.
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
