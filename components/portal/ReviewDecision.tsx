"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { Select, Input } from "@/components/portal/ui/Field";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

const REASON_CODES = [
  ["guideline_violation", "Guideline violation"],
  ["below_consensus_threshold", "Below quality bar"],
  ["failed_gold_task", "Failed gold task"],
  ["confirmed_fraud", "Confirmed fraud"],
] as const;

export function ReviewDecision({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reasonCode, setReasonCode] = useState("guideline_violation");
  const [detail, setDetail] = useState("");

  async function decide(decision: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    const { ok, data } = await postJson(`/api/validate/${reviewId}`, { decision, ...extra });
    setBusy(false);
    if (!ok) { setErr(data.error ?? "Failed."); return; }
    router.push("/validate");
    router.refresh();
  }

  return (
    <div>
      {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide("approve")} disabled={busy}>Approve</Button>
          <Button size="sm" variant="danger" onClick={() => setRejecting(true)} disabled={busy}>Reject — reason code</Button>
          <Button size="sm" variant="secondary" onClick={() => decide("correction_requested")} disabled={busy}>Request correction</Button>
          <Button size="sm" variant="secondary" onClick={() => decide("escalate")} disabled={busy}>Escalate to ops</Button>
        </div>
      ) : (
        <div className="rounded-lg border border-p-border bg-p-surface-2 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-p-secondary">Reason code (required)</label>
              <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                {REASON_CODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-p-secondary">Detail (rule / aspect)</label>
              <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. sarcasm_handling" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="danger" disabled={busy || ((reasonCode === "guideline_violation" || reasonCode === "confirmed_fraud") && !detail.trim())} onClick={() => decide("reject", { reasonCode, reasonDetail: detail || null })}>
              Confirm reject
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
