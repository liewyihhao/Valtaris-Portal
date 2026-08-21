"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";

export function ValidatorRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(action: "pause" | "resume") {
    setBusy(true);
    await fetch(`/api/admin/validators/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    router.refresh();
  }
  return status === "active" ? (
    <Button size="sm" variant="secondary" onClick={() => act("pause")} disabled={busy}>Pause</Button>
  ) : status === "paused" ? (
    <Button size="sm" onClick={() => act("resume")} disabled={busy}>Resume</Button>
  ) : (
    <span className="text-xs text-p-disabled">revoked</span>
  );
}
