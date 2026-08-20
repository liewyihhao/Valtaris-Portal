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

// Internal staff roles that may enter the ops/PM console (Zone D).
const STAFF_ROLES = ["ops", "admin", "project_manager"];
// Payout, review, and compliance duties.
const OPS_ROLES = ["ops", "admin"];
// Talent-pool / cohort management (PMs own pool selection; admin + ops too).
const PM_ROLES = ["project_manager", "admin", "ops"];

/** Require any internal staff; redirect otherwise. Server-side enforcement for Zone D. */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!STAFF_ROLES.includes(user.role)) redirect("/dashboard");
  return user;
}

/** Require ops/admin (payout, review, compliance). */
export async function requireOps() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!OPS_ROLES.includes(user.role)) redirect("/admin/talent");
  return user;
}

/** Require project_manager/admin/ops (talent + cohort management). */
export async function requirePM() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!PM_ROLES.includes(user.role)) redirect("/admin");
  return user;
}

export function isStaff(role: string | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}
