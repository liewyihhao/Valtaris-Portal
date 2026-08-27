"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";

export function ProjectActions({ projectId, isActive }: { projectId: string; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/admin/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isActive ? "deactivate" : "activate" }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button size="sm" variant={isActive ? "secondary" : "primary"} disabled={busy} onClick={toggle}>
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
