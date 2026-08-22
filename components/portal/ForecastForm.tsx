"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

export function ForecastForm({ tracks }: { tracks: { id: string; name: string }[] }) {
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
    const { ok: success, data } = await postJson<{ forecast?: { projectedActiveOutput: number } }>("/api/admin/forecast", {
      trackId: fd.get("trackId"),
      projectedIntake: Number(fd.get("projectedIntake")),
    });
    setBusy(false);
    if (!success) { setErr(data.error ?? "Failed to generate forecast."); return; }
    setOk(`Projected ~${data.forecast?.projectedActiveOutput} active certified annotators from that intake.`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      {err && <div className="w-full"><Alert tone="danger">{err}</Alert></div>}
      {ok && <div className="w-full"><Alert tone="success">{ok}</Alert></div>}
      <div className="min-w-56">
        <Field label="Track" htmlFor="trackId">
          <Select id="trackId" name="trackId" required defaultValue="">
            <option value="" disabled>Select track…</option>
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="w-40">
        <Field label="Projected intake" htmlFor="projectedIntake">
          <Input id="projectedIntake" name="projectedIntake" type="number" min={1} required placeholder="e.g. 500" />
        </Field>
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Projecting…" : "Generate forecast"}</Button>
    </form>
  );
}
