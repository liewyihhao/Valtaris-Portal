"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Field, Textarea } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

export function NewAppealForm({
  payoutId,
  summary,
}: {
  payoutId: string;
  summary: { batch: string; amount: string; reason: string };
}) {
  const router = useRouter();
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { ok, data } = await postJson<{ id: string }>("/api/appeals", { payoutId, explanation });
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Could not submit appeal.");
      return;
    }
    router.push(`/appeals/${data.id}`);
    router.refresh();
  }

  return (
    <Card className="max-w-xl">
      <div className="mb-4 rounded-lg border border-p-border bg-p-surface-2 p-4 text-sm">
        <div className="text-p-primary"><b>Batch:</b> {summary.batch}</div>
        <div className="text-p-primary"><b>Amount:</b> {summary.amount}</div>
        <div className="text-p-primary"><b>Reason on file:</b> {summary.reason}</div>
      </div>
      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
      <form onSubmit={submit}>
        <Field label="Why should this be reconsidered?" htmlFor="exp">
          <Textarea id="exp" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explain what you think went wrong…" required />
        </Field>
        <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit appeal"}</Button>
        <p className="mt-3 text-xs text-p-secondary">We respond within 3 business days.</p>
      </form>
    </Card>
  );
}
