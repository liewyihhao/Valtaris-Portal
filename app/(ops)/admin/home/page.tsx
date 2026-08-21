import Link from "next/link";
import { requireStaff } from "@/lib/portal/session";
import { resolveCapabilities, CAP_LABEL, type Capability } from "@/lib/portal/capabilities";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";

const SECTIONS: { cap: Capability; href: string; label: string; desc: string }[] = [
  { cap: "recruiter", href: "/admin/funnel", label: "Recruiting funnel", desc: "Funnel health, cohorts, worker directory." },
  { cap: "training_author", href: "/admin/training", label: "Training & content", desc: "Learning Center courses + guidelines." },
  { cap: "assessment_ops", href: "/admin/questions", label: "Assessment", desc: "Question banks, exam mapping." },
  { cap: "trust_safety", href: "/admin", label: "Trust & Safety", desc: "Unified flags, appeals, escalations." },
  { cap: "validator_ops", href: "/admin/validators", label: "Validator Ops", desc: "Roster, calibration, capacity." },
  { cap: "finance_ops", href: "/admin/payouts", label: "Finance / Payout", desc: "Payout runs, rate cards, margin." },
  { cap: "compliance_ops", href: "/admin/compliance", label: "Compliance", desc: "Tax, sanctions, KYC, lifecycle." },
  { cap: "support", href: "/admin/support", label: "Support", desc: "Ticket queue by category." },
  { cap: "executive", href: "/admin/executive", label: "Executive", desc: "Top-line rollup across all dashboards." },
];

export default async function OpsHome() {
  const user = await requireStaff();
  const caps = await resolveCapabilities(user.id, user.role);
  const mine = SECTIONS.filter((s) => caps.has(s.cap));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Ops console</h1>
      <p className="mt-1 text-sm text-p-secondary">Your role-scoped view. You hold these capabilities:</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...caps].map((c) => <Badge key={c} intent="info" icon={false}>{CAP_LABEL[c as Capability] ?? c}</Badge>)}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-colors hover:border-p-border-focus">
              <div className="font-medium text-p-primary">{s.label}</div>
              <div className="mt-1 text-sm text-p-secondary">{s.desc}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
