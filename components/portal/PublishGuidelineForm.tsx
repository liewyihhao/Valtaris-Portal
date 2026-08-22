"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

export function PublishGuidelineForm({ tracks }: { tracks: { id: string; name: string }[] }) {
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
    const { ok: success, data } = await postJson<{ version?: number; affectedCount?: number }>(
      "/api/admin/guidelines",
      {
        trackId: fd.get("trackId"),
        title: fd.get("title"),
        content: fd.get("content"),
        changeSummary: fd.get("changeSummary"),
      }
    );
    setBusy(false);
    if (!success) { setErr(data.error ?? "Failed to publish."); return; }
    setOk(`Published v${data.version}. Recert module queued to ${data.affectedCount} certified annotator(s).`);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {err && <Alert tone="danger">{err}</Alert>}
      {ok && <Alert tone="success">{ok}</Alert>}
      <Field label="Track" htmlFor="trackId">
        <Select id="trackId" name="trackId" required defaultValue="">
          <option value="" disabled>Select track…</option>
          {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <Field label="Guideline title" htmlFor="title">
        <Input id="title" name="title" required placeholder="e.g. Text & NLP annotation guidelines" />
      </Field>
      <Field label="Full guideline content" htmlFor="content">
        <Textarea id="content" name="content" required rows={5} placeholder="The full guideline document for this version…" />
      </Field>
      <Field label="What changed (recert module)" htmlFor="changeSummary" hint="Becomes the short 'what changed' lesson pushed to certified annotators">
        <Textarea id="changeSummary" name="changeSummary" required rows={4} placeholder="Summarize the specific changes since the last version…" />
      </Field>
      <Button type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish version & push recert"}</Button>
    </form>
  );
}
