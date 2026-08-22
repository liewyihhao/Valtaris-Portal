import { requireCapability } from "@/lib/portal/capabilities";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { AppealActions, FlagActions } from "@/components/portal/ReviewActions";
import { formatMoney, formatReason, timeLeft } from "@/lib/portal/labels";
import type { PayoutReasonCode } from "@/lib/portal/constants";

const FLAG_LABEL: Record<string, string> = {
  self_report_mismatch: "Self-report / calibration mismatch",
  identity_reverification: "Identity re-verification",
  fraud_suspected: "Fraud suspected",
  appeal: "Payout appeal",
  payout_hold_escalation: "Payout hold escalation",
};

export default async function ReviewQueue() {
  await requireCapability("trust_safety");
  const [flags, appeals] = await Promise.all([
    prisma.reviewFlag.findMany({
      where: { status: "open", type: { not: "appeal" } },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.appeal.findMany({
      where: { status: { in: ["open", "under_review"] } },
      include: { user: true, payout: { include: { taskBatch: true } } },
      orderBy: { slaDueAt: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Review queue</h1>
      <p className="mt-1 text-sm text-p-secondary">Everything the automated flow flagged, with the context to decide inline.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge intent="neutral" icon={false}>All ({flags.length + appeals.length})</Badge>
        <Badge intent="warning" icon={false}>Flags ({flags.length})</Badge>
        <Badge intent="info" icon={false}>Appeals ({appeals.length})</Badge>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Appeals — SLA sorted</h2>
      <div className="mt-3 space-y-3">
        {appeals.length === 0 && <Alert tone="success" title="No open appeals">Nothing awaiting response.</Alert>}
        {appeals.map((a) => (
          <Card key={a.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-p-primary">{a.user.email}</div>
                <div className="mt-1 text-sm text-p-secondary">
                  {a.payout.taskBatch.taskType} · {formatMoney(a.payout.grossAmount, a.payout.currency)} ·{" "}
                  {formatReason(a.reasonCode as PayoutReasonCode | null, a.payout.reasonDetail) ?? "—"}
                </div>
                <p className="mt-2 max-w-2xl whitespace-pre-wrap rounded-lg border border-p-border bg-p-surface-2 p-3 text-sm text-p-primary">
                  {a.explanation}
                </p>
              </div>
              <Badge intent={new Date(a.slaDueAt) < new Date() ? "danger" : "warning"}>
                SLA {timeLeft(a.slaDueAt)}
              </Badge>
            </div>
            <AppealActions appealId={a.id} />
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-p-secondary">Flags</h2>
      <div className="mt-3 space-y-3">
        {flags.length === 0 && <Alert tone="success" title="No open flags">Queue is clear.</Alert>}
        {flags.map((f) => (
          <Card key={f.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-p-primary">{f.user.email}</div>
                <div className="mt-1"><Badge intent="warning">{FLAG_LABEL[f.type] ?? f.type}</Badge></div>
                {f.note && <p className="mt-2 text-sm text-p-secondary">{f.note}</p>}
                {f.context ? (
                  <pre className="mt-2 max-w-2xl overflow-x-auto rounded-lg border border-p-border bg-p-surface-2 p-3 text-xs text-p-secondary">
                    {JSON.stringify(f.context, null, 2)}
                  </pre>
                ) : null}
              </div>
              <Link href={`/admin/workers?q=${encodeURIComponent(f.user.email)}`} className="text-xs text-p-accent hover:underline">
                View worker →
              </Link>
            </div>
            <FlagActions flagId={f.id} flagType={f.type} payoutId={(f.context as { payoutId?: string } | null)?.payoutId} />
          </Card>
        ))}
      </div>
    </div>
  );
}
