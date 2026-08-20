import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { NewAppealForm } from "@/components/portal/NewAppealForm";
import { Alert } from "@/components/portal/ui/Alert";
import { formatMoney, formatReason } from "@/lib/portal/labels";
import { isAppealable } from "@/lib/portal/payout";
import type { PayoutStatus, PayoutReasonCode } from "@/lib/portal/constants";

export default async function NewAppealPage({ searchParams }: { searchParams: Promise<{ payoutId?: string }> }) {
  const user = await requireUser();
  const { payoutId } = await searchParams;
  if (!payoutId) redirect("/earnings");

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { taskBatch: true, appeal: true },
  });

  if (!payout || payout.userId !== user.id) redirect("/earnings");
  if (payout.appeal) redirect(`/appeals/${payout.appeal.id}`);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Appeal a payout</h1>
      <p className="mt-1 mb-6 text-sm text-p-secondary">Tied to the specific batch and reason code below.</p>

      {isAppealable(payout.status as PayoutStatus) ? (
        <NewAppealForm
          payoutId={payout.id}
          summary={{
            batch: payout.taskBatch.taskType,
            amount: formatMoney(payout.grossAmount, payout.currency),
            reason: formatReason(payout.reasonCode as PayoutReasonCode | null, payout.reasonDetail) ?? "—",
          }}
        />
      ) : (
        <Alert tone="warning">This payout isn&apos;t in an appealable state.</Alert>
      )}
    </div>
  );
}
