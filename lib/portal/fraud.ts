import { prisma } from "@/lib/db";
import { validateTransition } from "./payout";
import { writeAudit } from "./audit";
import { notify } from "./notify";
import { t } from "./i18n";
import { pauseValidatorOnFraud } from "./validator";
import type { PayoutStatus } from "./constants";

// ---------------------------------------------------------------------------
// CONFIRMED-FRAUD CLAWBACK (the Trust & Safety execution action).
//
// The single place a payout is clawed back for confirmed fraud. It ties the
// three consequences together so they can't drift apart: reverse the pay
// (reason-coded, appealable), pause the worker's validator capability, and
// revoke Studio access. Clawback is reserved for confirmed_fraud by the payout
// state machine — ordinary QA misses are never clawed back.
// ---------------------------------------------------------------------------

export type ClawbackResult = { ok: true; userId: string } | { ok: false; error: string };

export async function confirmFraudClawback(params: {
  payoutId: string;
  reasonDetail: string;
  actorId: string;
}): Promise<ClawbackResult> {
  const detail = params.reasonDetail?.trim();
  if (!detail || detail.length < 3) {
    return { ok: false, error: "A specific fraud detail is required (the confirmed fraud type)." };
  }

  const payout = await prisma.payout.findUnique({ where: { id: params.payoutId } });
  if (!payout) return { ok: false, error: "Payout not found." };

  const check = validateTransition({
    from: payout.status as PayoutStatus,
    to: "clawed_back",
    reasonCode: "confirmed_fraud",
    reasonDetail: detail,
  });
  if (!check.ok) return { ok: false, error: check.error };

  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: "clawed_back", reasonCode: "confirmed_fraud", reasonDetail: detail },
  });
  await writeAudit({
    entityType: "Payout",
    entityId: payout.id,
    action: "clawed_back_fraud",
    actorId: params.actorId,
    before: { status: payout.status },
    after: { status: "clawed_back", reasonCode: "confirmed_fraud", reasonDetail: detail },
  });

  // Cross-impacts: pause validator capabilities + revoke Studio access
  // (pauseValidatorOnFraud emits the set-active push and notifies).
  await pauseValidatorOnFraud(payout.userId);

  // Adverse, reason-coded, and appealable.
  await notify({
    userId: payout.userId,
    type: "lifecycle",
    category: "payout",
    title: t("notif.payout.clawback.title"),
    body: t("notif.payout.clawback.body", { detail }),
    deepLink: "/appeals",
    email: true,
  });

  return { ok: true, userId: payout.userId };
}
