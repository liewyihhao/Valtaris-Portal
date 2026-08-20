import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Badge } from "@/components/portal/ui/Badge";
import type { BadgeIntent } from "@/lib/portal/labels";
import { formatMoney, formatReason } from "@/lib/portal/labels";
import { APPEAL_SLA_BUSINESS_DAYS, type PayoutReasonCode } from "@/lib/portal/constants";

const APPEAL_META: Record<string, { label: string; intent: BadgeIntent }> = {
  open: { label: "Open", intent: "warning" },
  under_review: { label: "Under review", intent: "info" },
  upheld: { label: "Upheld — restored", intent: "success" },
  denied: { label: "Denied", intent: "danger" },
};

export default async function AppealsPage() {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");

  const appeals = await prisma.appeal.findMany({
    where: { userId: user.id },
    include: { payout: { include: { taskBatch: true } } },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Appeals</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Dispute any rejected or reduced payout. We respond within {APPEAL_SLA_BUSINESS_DAYS} business days.
      </p>

      <div className="mt-6">
        <Table>
          <THead><TH>Batch</TH><TH>Amount</TH><TH>Reason disputed</TH><TH>Status</TH><TH></TH></THead>
          <TBody>
            {appeals.length === 0 && <EmptyRow colSpan={5}>No appeals. You can start one from the Earnings screen.</EmptyRow>}
            {appeals.map((a) => {
              const meta = APPEAL_META[a.status];
              return (
                <TR key={a.id}>
                  <TD className="text-p-primary">{a.payout.taskBatch.taskType}</TD>
                  <TD className="text-p-primary">{formatMoney(a.payout.grossAmount, a.payout.currency)}</TD>
                  <TD className="text-xs text-p-secondary">{formatReason(a.reasonCode as PayoutReasonCode | null, a.payout.reasonDetail) ?? "—"}</TD>
                  <TD><Badge intent={meta.intent}>{meta.label}</Badge></TD>
                  <TD className="text-right"><Link href={`/appeals/${a.id}`} className="text-sm text-p-accent hover:underline">View →</Link></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
