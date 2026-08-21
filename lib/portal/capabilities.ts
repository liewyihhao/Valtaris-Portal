import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "./session";

// Internal-staff capabilities — additive layers on one identity (master design
// §2.11). Backward-compatible: the existing coarse roles map onto capability
// sets so nothing built earlier breaks.
export type Capability =
  | "recruiter"
  | "training_author"
  | "assessment_ops"
  | "finance_ops"
  | "trust_safety"
  | "validator_ops"
  | "support"
  | "compliance_ops"
  | "executive";

export const ALL_CAPABILITIES: Capability[] = [
  "recruiter", "training_author", "assessment_ops", "finance_ops",
  "trust_safety", "validator_ops", "support", "compliance_ops", "executive",
];

export const CAP_LABEL: Record<Capability, string> = {
  recruiter: "Recruiter",
  training_author: "Training / Content",
  assessment_ops: "Assessment Ops",
  finance_ops: "Finance / Payout Ops",
  trust_safety: "Trust & Safety",
  validator_ops: "Validator Ops",
  support: "Support",
  compliance_ops: "Compliance Ops",
  executive: "Executive",
};

// Legacy roles → capability sets (so ops/admin/pm keep their existing access).
const OPS_SET: Capability[] = [
  "trust_safety", "finance_ops", "assessment_ops", "validator_ops", "compliance_ops", "support", "training_author", "executive",
];

/** Resolve a user's effective internal capabilities (role-derived + granted). */
export async function resolveCapabilities(userId: string, role: string): Promise<Set<Capability>> {
  if (role === "admin") return new Set(ALL_CAPABILITIES);
  const caps = new Set<Capability>();
  if (role === "ops") OPS_SET.forEach((c) => caps.add(c));
  if (role === "project_manager") caps.add("recruiter");
  const granted = await prisma.internalCapability.findMany({ where: { userId }, select: { capability: true } });
  granted.forEach((g) => caps.add(g.capability as Capability));
  return caps;
}

/** Server guard for a specific capability. Redirects if the user lacks it. */
export async function requireCapability(cap: Capability) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const caps = await resolveCapabilities(user.id, user.role);
  if (!caps.has(cap)) redirect(caps.size > 0 ? "/admin/home" : "/dashboard");
  return { user, caps };
}
