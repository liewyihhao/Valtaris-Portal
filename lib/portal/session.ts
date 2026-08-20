import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** The full DB user for the current session, or null. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require ops/admin; redirect otherwise. Server-side enforcement for Zone D. */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ops" && user.role !== "admin") redirect("/dashboard");
  return user;
}

export function isStaff(role: string | undefined): boolean {
  return role === "ops" || role === "admin";
}
