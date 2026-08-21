import crypto from "crypto";

// Minimal HS256 JWT (sign/verify) — dependency-free, for the short-lived Studio
// SSO token. The same STUDIO_SSO_SECRET is configured in the Valtaris-Studio
// fork's /sso/login view so it can verify tokens this Portal issues.

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export type SsoClaims = {
  sub: string; // portal user id
  email: string;
  lsUserId?: string | null;
  jti: string;
  iat: number;
  exp: number;
};

export function signJwt(payload: Omit<SsoClaims, "iat" | "jti"> & { jti?: string }, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims: SsoClaims = { ...payload, jti: payload.jti ?? crypto.randomUUID(), iat: now };
  const head = b64urlJson(header);
  const body = b64urlJson(claims);
  const sig = b64url(crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): SsoClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(fromB64url(body).toString("utf8")) as SsoClaims;
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
