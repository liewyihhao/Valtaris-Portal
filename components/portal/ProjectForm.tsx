"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

export function ProjectForm({ tracks }: { tracks: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(null);
    const fd = new FormData(e.currentTarget);
    const { ok: success, data } = await postJson<{ id?: string }>("/api/admin/projects", {
      taskType: fd.get("taskType"),
      trackId: fd.get("trackId"),
      clientName: fd.get("clientName"),
      complexityMultiplier: Number(fd.get("complexityMultiplier") || 1),
      estimatedItems: Number(fd.get("estimatedItems") || 0),
    });
    setBusy(false);
    if (!success) { setErr(data.error ?? "Failed to create project."); return; }
    setOk("Project created. Staff it from the talent pool below.");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {err && <Alert tone="danger">{err}</Alert>}
      {ok && <Alert tone="success">{ok}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Task type / project name" htmlFor="taskType">
          <Input id="taskType" name="taskType" required placeholder="e.g. Sentiment tagging — batch 3" />
        </Field>
        <Field label="Client" htmlFor="clientName" hint="new or existing (matched by name)">
          <Input id="clientName" name="clientName" required placeholder="e.g. Client A" />
        </Field>
        <Field label="Track" htmlFor="trackId">
          <Select id="trackId" name="trackId" required defaultValue="">
            <option value="" disabled>Select track…</option>
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Complexity multiplier" htmlFor="complexityMultiplier" hint="pay = base × complexity × tier">
          <Input id="complexityMultiplier" name="complexityMultiplier" type="number" step="0.05" min="0.1" defaultValue="1.0" />
        </Field>
        <Field label="Estimated items" htmlFor="estimatedItems">
          <Input id="estimatedItems" name="estimatedItems" type="number" min="0" defaultValue="0" placeholder="e.g. 5000" />
        </Field>
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create project"}</Button>
    </form>
  );
}
