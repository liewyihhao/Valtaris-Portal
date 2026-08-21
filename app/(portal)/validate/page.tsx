import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/portal/session";
import { isValidator, getValidatorQueue } from "@/lib/portal/validator";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { DOMAIN_LABEL } from "@/lib/portal/constants";
import type { BadgeIntent } from "@/lib/portal/labels";

const REASON: Record<string, { label: string; intent: BadgeIntent }> = {
  probation: { label: "Probation (100% reviewed)", intent: "warning" },
  appeal: { label: "Appeal", intent: "info" },
  failed_auto_check: { label: "Auto-check borderline", intent: "warning" },
  sample: { label: "Random sample", intent: "neutral" },
  spotcheck: { label: "Post-payout spot-check", intent: "neutral" },
};

function age(from: Date): string {
  const h = Math.floor((Date.now() - from.getTime()) / 3.6e6);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export default async function ValidateQueue() {
  const user = await requireUser();
  if (!(await isValidator(user.id))) redirect("/dashboard");
  const queue = await getValidatorQueue(user.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Validator queue</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Review submissions in the tracks you validate. Probation and appeal items are prioritised. You&apos;re paid per review.
      </p>

      <div className="mt-4">
        <Alert tone="info" title="Same account, one more queue">
          &quot;Validate&quot; appears here because you hold an active Validator capability. Your annotation work, earnings, and
          payout method are unchanged — review pay lands in the same balance as <code>review:&lt;track&gt;</code> line items.
        </Alert>
      </div>

      <div className="mt-5">
        <Table>
          <THead><TH>Track</TH><TH>Routed reason</TH><TH>Age</TH><TH></TH></THead>
          <TBody>
            {queue.length === 0 && <EmptyRow colSpan={4}>Your review queue is clear.</EmptyRow>}
            {queue.map((r) => {
              const meta = REASON[r.routedReason] ?? { label: r.routedReason, intent: "neutral" as BadgeIntent };
              return (
                <TR key={r.id}>
                  <TD className="text-p-primary">{DOMAIN_LABEL[r.payout.taskBatch.track.domain as keyof typeof DOMAIN_LABEL]}</TD>
                  <TD><Badge intent={meta.intent}>{meta.label}</Badge></TD>
                  <TD className="text-xs text-p-secondary">{age(r.createdAt)}</TD>
                  <TD className="text-right"><Link href={`/validate/${r.id}`} className="text-sm text-p-accent hover:underline">Review →</Link></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
