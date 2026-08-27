import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Edge-safe auth instance (JWT verification only — no DB/bcrypt here).
const { auth } = NextAuth(authConfig);

// Routes that require a signed-in user (any role).
const AUTHED_PREFIXES = [
  "/apply",
  "/dashboard",
  "/earnings",
  "/payment-details",
  "/appeals",
  "/profile",
];

// Routes that require internal staff (ops / admin / project_manager).
const STAFF_PREFIXES = ["/admin"];
const STAFF_ROLES = ["ops", "admin", "project_manager", "internal"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role;

  const needsAuth = AUTHED_PREFIXES.some((p) => pathname.startsWith(p));
  const needsStaff = STAFF_PREFIXES.some((p) => pathname.startsWith(p));

  if ((needsAuth || needsStaff) && !session) {
    // Staff pages route to the staff/admin entrance; worker pages to the
    // annotator entrance. Two distinct logins.
    const url = new URL(needsStaff ? "/staff/login" : "/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (needsStaff && !STAFF_ROLES.includes(role as string)) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals, the auth API, and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|.*\\.).*)"],
};
