"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);

  async function act(action: "accept" | "decline") {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/invitations/${invitationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Failed."); return; }
    if (action === "accept" && data.setupUrl) { setSetupUrl(data.setupUrl); return; }
    router.refresh();
  }

  if (setupUrl) {
    return (
      <div className="mt-3 rounded-lg border border-p-accent/30 bg-p-accent-subtle/40 p-3">
        <p className="text-sm text-p-primary">Accepted! We emailed a link to set up your project login.</p>
        <p className="mt-1 text-xs text-p-secondary">Email is a dev stub — set it up here:</p>
        <a href={setupUrl} className="mt-1 block break-all font-mono text-xs text-p-accent underline">{setupUrl}</a>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button size="sm" disabled={busy} onClick={() => act("accept")}>Accept</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("decline")}>Decline</Button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
