"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { Select } from "@/components/portal/ui/Field";
import { Alert } from "@/components/portal/ui/Alert";

export function CohortActions({
  cohortId,
  status,
  batches,
}: {
  cohortId: string;
  status: string;
  batches: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [batchId, setBatchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    const { ok, data } = await postJsonPatch(`/api/admin/cohorts/${cohortId}`, body);
    setBusy(false);
    if (!ok) { setErr(data.error ?? "Failed."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {err && <Alert tone="danger">{err}</Alert>}
      {status !== "archived" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56">
            <label className="mb-1 block text-xs text-p-secondary">Assign to project / batch</label>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Select project…</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </Select>
          </div>
          <Button size="sm" disabled={busy || !batchId} onClick={() => patch({ action: "assign", taskBatchId: batchId })}>
            Assign &amp; invite members
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => patch({ action: "archive" })}>Archive</Button>
        </div>
      )}
    </div>
  );
}

// PATCH helper (postJson only does POST).
async function postJsonPatch(url: string, body: unknown) {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data: { error?: string } = {};
  try { data = await res.json(); } catch {}
  if (!res.ok && !data.error) data.error = `Server error (${res.status}).`;
  return { ok: res.ok, data };
}
