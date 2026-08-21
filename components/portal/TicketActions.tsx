"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { Input } from "@/components/portal/ui/Field";

export function TicketActions({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(status: string) {
    setBusy(true);
    await fetch(`/api/admin/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }) });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note…" className="max-w-xs" />
      <Button size="sm" onClick={() => act("resolved")} disabled={busy}>Resolve</Button>
      <Button size="sm" variant="secondary" onClick={() => act("in_progress")} disabled={busy}>In progress</Button>
    </div>
  );
}
