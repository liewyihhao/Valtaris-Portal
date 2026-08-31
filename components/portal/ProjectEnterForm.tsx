"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

export function ProjectEnterForm({ batchId, username }: { batchId: string; username: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const { ok, data } = await postJson("/api/project-access/enter", { batchId, password: fd.get("password") });
    setBusy(false);
    if (!ok) { setErr(data.error ?? "Failed."); return; }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm">
      <p className="mb-3 text-sm text-p-secondary">
        Sign in to this project as <span className="font-mono text-p-primary">{username}</span>.
      </p>
      {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
      <Field label="Project password" htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>
      <Button type="submit" disabled={busy}>{busy ? "Entering…" : "Enter project"}</Button>
    </form>
  );
}
