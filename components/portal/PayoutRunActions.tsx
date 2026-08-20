"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  let data: { error?: string } = {};
  try { data = await res.json(); } catch {}
  return { ok: res.ok, error: data.error };
}

export function CreateRunButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="text-right">
      <Button size="sm" disabled={disabled || busy} onClick={async () => {
        setBusy(true); setErr(null);
        const r = await call("/api/admin/payout-runs", "POST");
        setBusy(false);
        if (!r.ok) { setErr(r.error ?? "Failed."); return; }
        router.refresh();
      }}>{busy ? "Creating…" : "Create payout run"}</Button>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}

export function RunActions({ runId, status }: { runId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(action: string) {
    setBusy(true);
    await call(`/api/admin/payout-runs/${runId}`, "PATCH", { action });
    setBusy(false);
    router.refresh();
  }
  if (status === "completed" || status === "failed") return <span className="text-xs text-p-disabled">—</span>;
  return (
    <div className="flex justify-end gap-2">
      {status === "draft" && <Button size="sm" onClick={() => act("approve")} disabled={busy}>Approve</Button>}
      {status === "approved" && <Button size="sm" onClick={() => act("execute")} disabled={busy}>Execute</Button>}
      <Button size="sm" variant="secondary" onClick={() => act("cancel")} disabled={busy}>Cancel</Button>
    </div>
  );
}
