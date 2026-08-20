// Human-readable labels + badge intent for statuses and reason codes.
// Status is NEVER conveyed by color alone — every badge pairs a color intent
// with this text label (accessibility + payment-context clarity).

import type { PayoutReasonCode, PayoutStatus } from "./constants";
import { APPEAL_SLA_BUSINESS_DAYS } from "./constants";

export type BadgeIntent = "success" | "warning" | "danger" | "info" | "neutral";

export const PAYOUT_STATUS_META: Record<
  PayoutStatus,
  { label: string; intent: BadgeIntent }
> = {
  pending_qa: { label: "Pending QA", intent: "warning" },
  held: { label: "Held — in review", intent: "warning" },
  approved: { label: "Approved", intent: "info" },
  paid: { label: "Paid", intent: "success" },
  rejected: { label: "Rejected", intent: "danger" },
  clawed_back: { label: "Clawed back", intent: "danger" },
};

export const REASON_CODE_LABEL: Record<PayoutReasonCode, string> = {
  failed_gold_task: "Failed gold task",
  below_consensus_threshold: "Below consensus threshold",
  guideline_violation: "Guideline violation",
  confirmed_fraud: "Confirmed fraud",
};

export function formatReason(
  code: PayoutReasonCode | null | undefined,
  detail?: string | null
): string | null {
  if (!code) return null;
  const base = REASON_CODE_LABEL[code];
  return detail ? `${base}: ${detail}` : base;
}

/** Add N business days (skip Sat/Sun) for the published appeal SLA. */
export function addBusinessDays(
  from: Date,
  days: number = APPEAL_SLA_BUSINESS_DAYS
): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d;
}

export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function timeLeft(target: Date | null, now: Date = new Date()): string {
  if (!target) return "—";
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "overdue";
  const hours = Math.floor(ms / (3600 * 1000));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h left`;
}
