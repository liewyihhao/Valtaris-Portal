"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJsonPatch } from "@/lib/portal/client";

export function ApplicationActions({ applicationId, status }: { applicationId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);

  const decided = status === "invited" || status === "rejected";

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    const { ok, data } = await postJsonPatch<{ inviteUrl?: string }>(`/api/admin/applications/${applicationId}`, { action });
    setBusy(false);
    if (!ok) { setErr(data.error ?? "Failed."); return; }
    if (action === "approve" && data.inviteUrl) setInvite(data.inviteUrl);
    router.refresh();
  }

  if (decided && !invite) {
    return (
      <Alert tone={status === "invited" ? "success" : "info"}>
        {status === "invited"
          ? "Approved — an invite to set up their account was emailed."
          : "Rejected — a decline notice was emailed."}
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {err && <Alert tone="danger">{err}</Alert>}
      {invite ? (
        <Alert tone="success" title="Approved — invite sent">
          <p className="text-sm">Email is a dev stub, so use this invite link directly:</p>
          <a href={invite} className="mt-1 block break-all font-mono text-xs text-p-accent underline">{invite}</a>
        </Alert>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => act("approve")}>Approve &amp; invite</Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => act("reject")}>Reject</Button>
        </div>
      )}
    </div>
  );
}
