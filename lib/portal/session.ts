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

// Internal staff roles that may enter the ops/PM console (Zone D). "internal"
// is a granular staffer whose access comes entirely from InternalCapability rows.
const STAFF_ROLES = ["ops", "admin", "project_manager", "internal"];
const OPS_FAMILY_CAPS = ["trust_safety", "finance_ops", "assessment_ops", "validator_ops", "compliance_ops", "support", "training_author", "executive"];

async function hasAnyCap(userId: string, caps: string[]): Promise<boolean> {
  return (await prisma.internalCapability.count({ where: { userId, capability: { in: caps } } })) > 0;
}

/** Require any internal staff; redirect otherwise. Server-side enforcement for Zone D. */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (["ops", "admin", "project_manager"].includes(user.role)) return user;
  if (user.role === "internal" && (await prisma.internalCapability.count({ where: { userId: user.id } })) > 0) return user;
  redirect("/dashboard");
}

/** Require ops/admin family (payout, review, compliance) or a matching capability. */
export async function requireOps() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "ops" || user.role === "admin") return user;
  if (await hasAnyCap(user.id, OPS_FAMILY_CAPS)) return user;
  redirect("/admin/talent");
}

/** Require recruiter-family (talent + cohort management). */
export async function requirePM() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (["project_manager", "admin", "ops"].includes(user.role)) return user;
  if (await hasAnyCap(user.id, ["recruiter"])) return user;
  redirect("/admin");
}

export function isStaff(role: string | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}
