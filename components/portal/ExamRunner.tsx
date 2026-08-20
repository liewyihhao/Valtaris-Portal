"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";
import { cn } from "@/lib/utils";

type Item = { id: string; prompt: string; options: string[] };

export function ExamRunner({ trackId, items }: { trackId: string; items: Item[] }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = items[idx];
  const last = idx === items.length - 1;
  const selected = answers[item.id];

  async function finish() {
    setSubmitting(true);
    setError(null);
    const payload = {
      answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({ questionId, selectedIndex })),
    };
    const { ok, status, data } = await postJson<{ score: number; passed: boolean; tier: string }>(
      `/api/apply/exam/${trackId}`,
      payload
    );
    setSubmitting(false);
    if (status === 429) {
      setError("You're in a retry cooldown from a previous attempt. Please try again later.");
      return;
    }
    if (!ok) {
      setError(data.error ?? "Could not submit the exam.");
      return;
    }
    const q = new URLSearchParams({ score: String(data.score), passed: String(data.passed), tier: data.tier });
    router.push(`/apply/exam/${trackId}/result?${q.toString()}`);
    router.refresh();
  }

  return (
    <Card>
      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-p-secondary">
          Question {idx + 1} of {items.length}
        </span>
        <span className="text-xs text-p-secondary">Answers autosaved</span>
      </div>

      <div className="rounded-lg border border-p-border bg-p-surface-2 p-4">
        <p className="text-sm text-p-primary">{item.prompt}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {item.options.map((o, i) => (
          <label
            key={i}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
              selected === i ? "border-p-accent bg-p-accent-subtle text-p-accent" : "border-p-border text-p-primary hover:border-p-border-focus"
            )}
          >
            <input
              type="radio"
              name={item.id}
              checked={selected === i}
              onChange={() => setAnswers((p) => ({ ...p, [item.id]: i }))}
              className="h-4 w-4 accent-[#5b8def]"
            />
            {o}
          </label>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          ← Previous
        </Button>
        {last ? (
          <Button size="sm" onClick={finish} disabled={submitting || Object.keys(answers).length < items.length}>
            {submitting ? "Scoring…" : "Submit exam"}
          </Button>
        ) : (
          <Button size="sm" onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} disabled={selected === undefined}>
            Submit &amp; next →
          </Button>
        )}
      </div>
    </Card>
  );
}
