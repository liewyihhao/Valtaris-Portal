"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "accept" | "decline") {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/invitations/${invitationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button size="sm" disabled={busy} onClick={() => act("accept")}>Accept</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("decline")}>Decline</Button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
