"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";

export function TalentActions({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(action: string, note?: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/talent/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    let data: { error?: string } = {};
    try { data = await res.json(); } catch {}
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "Failed."); return; }
    router.refresh();
  }

  return (
    <div>
      {msg && <div className="mb-3"><Alert tone="danger">{msg}</Alert></div>}
      <div className="flex flex-wrap gap-2">
        {status === "suspended" ? (
          <Button size="sm" onClick={() => act("reactivate")} disabled={busy}>Reactivate</Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => act("suspend")} disabled={busy}>Suspend</Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => act("request_reverification")} disabled={busy}>Request re-verification</Button>
        <Button size="sm" variant="secondary" onClick={() => act("trigger_recert")} disabled={busy}>Trigger recertification</Button>
      </div>
    </div>
  );
}
