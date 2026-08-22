import Link from "next/link";
import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { StatCard, Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { CreateRunButton, RunActions } from "@/components/portal/PayoutRunActions";
import { getPayoutOverview, getNextRunCandidates } from "@/lib/portal/payout-monitor";
import { formatMoney, formatReason, timeLeft, PAYOUT_STATUS_META } from "@/lib/portal/labels";
import type { BadgeIntent } from "@/lib/portal/labels";
import type { PayoutStatus, PayoutReasonCode } from "@/lib/portal/constants";

const RUN_INTENT: Record<string, BadgeIntent> = {
  draft: "warning", approved: "info", executing: "info", completed: "success", failed: "danger",
};

export default async function PayoutMonitorPage() {
  await requireCapability("finance_ops");
  const { totals, exceptions, maxHoldHours } = await getPayoutOverview();
  const next = await getNextRunCandidates();
  const runs = await prisma.payoutRun.findMany({ orderBy: { createdAt: "desc" }, take: 15 });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Payout monitor</h1>
      <p className="mt-1 text-sm text-p-secondary">Money owed by state, exceptions, and payout runs. Max QA hold: {maxHoldHours}h.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Pending QA" value={formatMoney(totals.pending_qa)} />
        <StatCard label="Held" value={formatMoney(totals.held)} sub="past-SLA in exceptions" />
        <StatCard label="Approved (owed)" value={formatMoney(totals.approved)} />
        <StatCard label="Paid (7d)" value={formatMoney(totals.paidThisPeriod)} />
        <StatCard label="Rejected" value={formatMoney(totals.rejected)} />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-p-secondary">Next payout run</div>
            <p className="mt-1 text-sm text-p-primary">{next.count} approved payout(s) · {formatMoney(next.total)} ready to sweep.</p>
          </div>
          <CreateRunButton disabled={next.count === 0} />
        </div>
      </Card>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Exceptions</h2>
      <div className="mt-3">
        {exceptions.length === 0 ? (
          <Alert tone="success" title="No exceptions">No holds past SLA and no open appeals.</Alert>
        ) : (
          <Table>
            <THead><TH>Annotator</TH><TH>Batch</TH><TH>Amount</TH><TH>Status</TH><TH>Issue</TH></THead>
            <TBody>
              {exceptions.map((p) => (
                <TR key={p.id}>
                  <TD><Link href={`/admin/talent/${p.userId}`} className="text-p-primary hover:text-p-accent">{p.user.fullName ?? p.user.email}</Link></TD>
                  <TD className="text-p-secondary">{p.taskBatch.taskType}</TD>
                  <TD className="tabular-nums text-p-primary">{formatMoney(p.grossAmount, p.currency)}</TD>
                  <TD><Badge intent={PAYOUT_STATUS_META[p.status as PayoutStatus].intent}>{PAYOUT_STATUS_META[p.status as PayoutStatus].label}</Badge></TD>
                  <TD className="text-xs text-danger">
                    {p.holdExpiresAt && p.holdExpiresAt.getTime() < Date.now() ? `Hold ${timeLeft(p.holdExpiresAt)}` : null}
                    {p.appeal ? ` Appeal open (${formatReason(p.reasonCode as PayoutReasonCode | null, p.reasonDetail) ?? "—"})` : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Payout runs</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Period</TH><TH>Amount</TH><TH>Payouts</TH><TH>Status</TH><TH></TH></THead>
          <TBody>
            {runs.length === 0 && <EmptyRow colSpan={5}>No payout runs yet.</EmptyRow>}
            {runs.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs text-p-secondary">{r.periodStart.toLocaleDateString()} – {r.periodEnd.toLocaleDateString()}</TD>
                <TD className="tabular-nums text-p-primary">{formatMoney(r.totalAmount)}</TD>
                <TD className="text-p-secondary">{r.payoutCount}</TD>
                <TD><Badge intent={RUN_INTENT[r.status] ?? "neutral"}>{r.status}</Badge></TD>
                <TD><RunActions runId={r.id} status={r.status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
