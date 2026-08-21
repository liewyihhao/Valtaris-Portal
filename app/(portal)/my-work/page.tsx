import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { StatCard, Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { getEarningsSummary } from "@/lib/portal/earnings";
import { formatMoney } from "@/lib/portal/labels";
import { TIER_LABEL, DOMAIN_LABEL, type Tier } from "@/lib/portal/constants";

// "How am I doing" — one coherent view over data the portal already owns
// (certification, review outcomes, payouts) + the WorkSummary contract that the
// future Label Studio bridge will write into. See master design §2.4.
export default async function MyWorkPage() {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");

  const [quals, summaries, reviews, earnings] = await Promise.all([
    prisma.qualification.findMany({ where: { userId: user.id }, include: { track: true } }),
    prisma.workSummary.findMany({ where: { userId: user.id }, orderBy: { periodEnd: "desc" }, take: 12 }),
    prisma.reviewAssignment.count({ where: { payout: { userId: user.id }, decision: { not: null } } }),
    getEarningsSummary(user.id),
  ]);

  const totalCompleted = summaries.reduce((s, w) => s + w.unitsCompleted, 0);
  const totalApproved = summaries.reduce((s, w) => s + w.unitsApproved, 0);
  const approvalRate = totalCompleted ? Math.round((totalApproved / totalCompleted) * 100) : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">My work</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Your standing, output, and pay in one place. Task-volume metrics are internally sourced today; the Label Studio
        bridge will feed the same view later without you noticing the switch.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Certifications" value={String(quals.length)} />
        <StatCard label="Units completed" value={String(totalCompleted)} sub="last periods" />
        <StatCard label="Approval rate" value={approvalRate !== null ? `${approvalRate}%` : "—"} />
        <StatCard label="Paid to date" value={formatMoney(earnings.paidTotal)} />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Certifications</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Track</TH><TH>Tier</TH><TH>Verified</TH></THead>
          <TBody>
            {quals.length === 0 && <EmptyRow colSpan={3}>No certifications yet.</EmptyRow>}
            {quals.map((q) => (
              <TR key={q.id}>
                <TD className="text-p-primary">{DOMAIN_LABEL[q.track.domain as keyof typeof DOMAIN_LABEL]}</TD>
                <TD><Badge intent="info" icon={false}>{TIER_LABEL[q.tier as Tier]}</Badge></TD>
                <TD className="text-xs text-p-secondary">{q.verifiedAt?.toLocaleDateString() ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Work summary</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Period</TH><TH>Task type</TH><TH>Completed</TH><TH>Approved</TH><TH>Rejected</TH><TH>Source</TH></THead>
          <TBody>
            {summaries.length === 0 && <EmptyRow colSpan={6}>No work summary rows yet.</EmptyRow>}
            {summaries.map((w) => (
              <TR key={w.id}>
                <TD className="whitespace-nowrap text-xs text-p-secondary">{w.periodStart.toLocaleDateString()}–{w.periodEnd.toLocaleDateString()}</TD>
                <TD className="text-p-secondary">{w.taskType}</TD>
                <TD className="text-p-primary">{w.unitsCompleted}</TD>
                <TD className="text-success">{w.unitsApproved}</TD>
                <TD className="text-danger">{w.unitsRejected}</TD>
                <TD><Badge intent="neutral" icon={false}>{w.sourceSystem}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <Card className="mt-4">
        <div className="text-sm text-p-secondary">Reviews of your work resolved by validators: <b className="text-p-primary">{reviews}</b>. Available balance: <b className="text-p-primary">{formatMoney(earnings.available)}</b>.</div>
      </Card>
    </div>
  );
}
