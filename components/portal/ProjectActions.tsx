"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";

export function ProjectActions({
  projectId,
  isActive,
  studioProjectId,
  studioBaseUrl,
}: {
  projectId: string;
  isActive: boolean;
  studioProjectId: string | null;
  studioBaseUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(action: "activate" | "deactivate" | "provision") {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error ?? "Failed."); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {studioProjectId ? (
          <a
            href={`${studioBaseUrl}/projects/${studioProjectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-p-border px-3 py-1.5 text-xs text-p-accent hover:underline"
          >
            Open in Studio ↗
          </a>
        ) : (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => patch("provision")}>
            {busy ? "Provisioning…" : "Provision Studio project"}
          </Button>
        )}
        <Button size="sm" variant={isActive ? "secondary" : "primary"} disabled={busy} onClick={() => patch(isActive ? "deactivate" : "activate")}>
          {isActive ? "Deactivate" : "Activate"}
        </Button>
      </div>
      {msg && <span className="text-xs text-danger">{msg}</span>}
    </div>
  );
}
