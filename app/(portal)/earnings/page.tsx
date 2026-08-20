import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card, StatCard } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { RequestPayoutButton } from "@/components/portal/RequestPayoutButton";
import { getEarningsSummary } from "@/lib/portal/earnings";
import { formatMoney, formatReason, timeLeft, PAYOUT_STATUS_META } from "@/lib/portal/labels";
import { MIN_PAYOUT_THRESHOLD_USD } from "@/lib/portal/constants";
import { isAppealable } from "@/lib/portal/payout";
import type { PayoutStatus, PayoutReasonCode } from "@/lib/portal/constants";

export default async function EarningsPage() {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");

  const { payouts, available, pending, paidTotal } = await getEarningsSummary(user.id);
  const method = await prisma.payoutMethod.findFirst({
    where: { userId: user.id, isActive: true, verifiedAt: { not: null } },
  });
  const canRequest = available >= MIN_PAYOUT_THRESHOLD_USD && !!method;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Earnings &amp; payout history</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Every line shows a specific status and, for anything reduced, a specific reason code — never a bare
        &quot;inaccurate work.&quot;
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Available balance" value={formatMoney(available)} sub="approved, awaiting payout" />
        <StatCard label="Pending QA" value={formatMoney(pending)} sub="in the quality window" />
        <StatCard label="Paid to date" value={formatMoney(paidTotal)} />
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-p-secondary">Request a payout</div>
            <p className="mt-1 text-sm text-p-secondary">
              Minimum {formatMoney(MIN_PAYOUT_THRESHOLD_USD)}.{" "}
              {!method && (
                <Link href="/payment-details" className="text-p-accent hover:underline">Add a payout method first →</Link>
              )}
            </p>
          </div>
          <RequestPayoutButton disabled={!canRequest} />
        </div>
      </Card>

      <div className="mt-6">
        <Table>
          <THead>
            <TH>Batch</TH><TH>Amount</TH><TH>Status</TH><TH>Reason / hold</TH><TH></TH>
          </THead>
          <TBody>
            {payouts.length === 0 && <EmptyRow colSpan={5}>No earnings yet — pick up a batch from your task hub.</EmptyRow>}
            {payouts.map((p) => {
              const meta = PAYOUT_STATUS_META[p.status as PayoutStatus];
              const reason = formatReason(p.reasonCode as PayoutReasonCode | null, p.reasonDetail);
              return (
                <TR key={p.id}>
                  <TD>
                    <div className="font-medium text-p-primary">{p.taskBatch.taskType}</div>
                    <div className="text-xs text-p-secondary">{p.taskBatch.track.name}</div>
                  </TD>
                  <TD className="tabular-nums text-p-primary">{formatMoney(p.grossAmount, p.currency)}</TD>
                  <TD><Badge intent={meta.intent}>{meta.label}</Badge></TD>
                  <TD className="text-xs text-p-secondary">
                    {p.status === "pending_qa" && p.holdExpiresAt ? timeLeft(p.holdExpiresAt) : null}
                    {reason ?? (p.status === "pending_qa" ? null : "—")}
                  </TD>
                  <TD className="text-right">
                    {isAppealable(p.status as PayoutStatus) && (
                      p.appeal ? (
                        <Link href={`/appeals/${p.appeal.id}`} className="text-sm text-p-accent hover:underline">View appeal →</Link>
                      ) : (
                        <Link href={`/appeals/new?payoutId=${p.id}`} className="text-sm text-p-accent hover:underline">Appeal →</Link>
                      )
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
