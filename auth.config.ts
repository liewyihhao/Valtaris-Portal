import type { NextAuthConfig } from "next-auth";

// Edge-safe base config: no database adapter, no bcrypt. Shared by middleware
// (which only needs to read/verify the JWT) and by the full config in auth.ts.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  providers: [], // real providers are added in auth.ts (Node runtime only)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
        token.verified = Boolean((user as { emailVerifiedAt?: Date | null }).emailVerifiedAt);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.verified = token.verified as boolean;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
