"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";

export function AppealActions({ appealId }: { appealId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resolve(decision: "upheld" | "denied") {
    if (note.trim().length < 3) return setErr("Add a short resolution note first.");
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/appeals/${appealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
    setBusy(false);
    if (!res.ok) { setErr("Failed."); return; }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Resolution note (required)…"
        className="w-full rounded-lg border border-p-border bg-p-surface-2 px-3 py-2 text-sm text-p-primary"
        rows={2}
      />
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => resolve("upheld")} disabled={busy}>Uphold &amp; restore pay</Button>
        <Button size="sm" variant="danger" onClick={() => resolve("denied")} disabled={busy}>Deny</Button>
      </div>
    </div>
  );
}

export function FlagActions({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "resolve" | "dismiss") {
    setBusy(true);
    await fetch(`/api/admin/flags/${flagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-2 flex gap-2">
      <Button size="sm" onClick={() => act("resolve")} disabled={busy}>Mark resolved</Button>
      <Button size="sm" variant="secondary" onClick={() => act("dismiss")} disabled={busy}>Dismiss</Button>
    </div>
  );
}
