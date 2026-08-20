import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import type { BadgeIntent } from "@/lib/portal/labels";
import { formatMoney, formatReason } from "@/lib/portal/labels";
import type { PayoutReasonCode } from "@/lib/portal/constants";

const APPEAL_META: Record<string, { label: string; intent: BadgeIntent }> = {
  open: { label: "Open", intent: "warning" },
  under_review: { label: "Under review", intent: "info" },
  upheld: { label: "Upheld — restored", intent: "success" },
  denied: { label: "Denied", intent: "danger" },
};

export default async function AppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");
  const { id } = await params;

  const appeal = await prisma.appeal.findUnique({
    where: { id },
    include: { payout: { include: { taskBatch: true } } },
  });
  if (!appeal || appeal.userId !== user.id) notFound();

  const meta = APPEAL_META[appeal.status];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Appeal detail</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="text-xs uppercase tracking-wide text-p-secondary">Disputed payout</div>
          <div className="mt-2 text-sm text-p-primary"><b>Batch:</b> {appeal.payout.taskBatch.taskType}</div>
          <div className="text-sm text-p-primary"><b>Amount:</b> {formatMoney(appeal.payout.grossAmount, appeal.payout.currency)}</div>
          <div className="text-sm text-p-primary"><b>Reason:</b> {formatReason(appeal.reasonCode as PayoutReasonCode | null, appeal.payout.reasonDetail) ?? "—"}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-p-secondary">Status</div>
          <div className="mt-2"><Badge intent={meta.intent}>{meta.label}</Badge></div>
          <div className="mt-2 text-sm text-p-secondary">
            Submitted {appeal.submittedAt.toLocaleDateString()} · SLA due {appeal.slaDueAt.toLocaleDateString()}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="text-xs uppercase tracking-wide text-p-secondary">Your explanation</div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-p-primary">{appeal.explanation}</p>
      </Card>

      {appeal.resolutionNote && (
        <div className="mt-4">
          <Alert tone={appeal.status === "upheld" ? "success" : "info"} title="Resolution">
            {appeal.resolutionNote}
          </Alert>
        </div>
      )}
    </div>
  );
}
