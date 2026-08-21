import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { getFunnel, getQualityTrust, getPayoutHealth, getValidatorCapacity } from "@/lib/portal/analytics";
import { StatCard, Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { formatMoney } from "@/lib/portal/labels";

export default async function ExecutivePage() {
  await requireCapability("executive");
  const [funnel, quality, payout, validator, openTickets, activeWorkers] = await Promise.all([
    getFunnel(),
    getQualityTrust(),
    getPayoutHealth(),
    getValidatorCapacity(),
    prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.user.count({ where: { role: "annotator", status: "active" } }),
  ]);
  const active = funnel.find((s) => s.key === "active")?.n ?? 0;
  const approved = funnel.find((s) => s.key === "approved")?.n ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Executive overview</h1>
      <p className="mt-1 text-sm text-p-secondary">Top-line health across every ops function. Read-only rollup — not a queue.</p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Workforce</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-4">
        <StatCard label="Active annotators" value={String(activeWorkers)} />
        <StatCard label="Approved (all-time)" value={String(approved)} />
        <StatCard label="Funnel: signed up" value={String(funnel[0]?.n ?? 0)} />
        <StatCard label="Active conversion" value={`${funnel.find((s) => s.key === "active")?.pct ?? 0}%`} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Quality &amp; trust</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-4">
        <StatCard label="QA approval rate" value={quality.qaApprovalRate !== null ? `${quality.qaApprovalRate}%` : "—"} />
        <StatCard label="Open appeals" value={String(quality.appealsOpen)} />
        <StatCard label="Fraud flags" value={String(quality.fraudFlags)} />
        <StatCard label="Clawbacks" value={String(quality.clawed)} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Payout health</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <StatCard label="Owed (approved)" value={formatMoney(payout.owed)} />
        <StatCard label="Paid (7d)" value={formatMoney(payout.paid7)} />
        <StatCard label="Hold-SLA breaches" value={String(payout.slaBreaches)} sub="need escalation" />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Capacity &amp; support</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-wide text-p-secondary">Validator ratio</div>
          <div className="mt-1 text-2xl font-semibold text-p-primary">{validator.ratio !== null ? `1 : ${validator.ratio}` : "—"}</div>
          <div className="mt-1 text-sm text-p-secondary">{validator.validators} validators · {validator.openReviews} open reviews</div>
          {validator.ratio !== null && validator.ratio > 20 && <div className="mt-2"><Badge intent="warning">Below target ratio</Badge></div>}
        </Card>
        <StatCard label="Open support tickets" value={String(openTickets)} />
        <StatCard label="Active workforce" value={String(active)} />
      </div>
    </div>
  );
}
