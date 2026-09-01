"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { postJsonPatch } from "@/lib/portal/client";

export function DeliverableActions({ projectId, deliveryStatus }: { projectId: string; deliveryStatus: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "review" | "deliver" | "reopen") {
    setBusy(true);
    await postJsonPatch(`/api/admin/projects/${projectId}`, { action });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {deliveryStatus === "in_progress" && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("review")}>Send for final review</Button>
      )}
      {deliveryStatus !== "delivered" && (
        <Button size="sm" disabled={busy} onClick={() => act("deliver")}>Mark delivered &amp; file to client</Button>
      )}
      {deliveryStatus === "delivered" && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("reopen")}>Reopen</Button>
      )}
      <a
        href={`/api/admin/projects/${projectId}/deliverable`}
        className="rounded-lg border border-p-border px-3 py-1.5 text-xs text-p-accent hover:underline"
      >
        Download deliverable (JSON)
      </a>
    </div>
  );
}
