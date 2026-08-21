"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";
import { cn } from "@/lib/utils";

type Scenario = { id: string; item: string; submittedLabel: string };

export function ValidatorExam({ trackId, scenarios }: { trackId: string; scenarios: Scenario[] }) {
  const router = useRouter();
  const [verdicts, setVerdicts] = useState<Record<string, "approve" | "reject">>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allAnswered = scenarios.every((s) => verdicts[s.id]);

  async function submit() {
    setBusy(true);
    setErr(null);
    const { ok, data } = await postJson<{ score: number; passed: boolean }>(`/api/validate/exam/${trackId}`, {
      answers: scenarios.map((s) => ({ id: s.id, verdict: verdicts[s.id] })),
    });
    setBusy(false);
    if (!ok) { setErr(data.error ?? "Could not submit."); return; }
    setResult({ score: data.score, passed: data.passed });
    router.refresh();
  }

  if (result) {
    return (
      <Alert tone={result.passed ? "success" : "warning"} title={result.passed ? "You passed" : "Not passed"}>
        Score: {result.score}%. {result.passed ? "You're now a Validator for this track — the Validate queue is in your nav." : "You need 85%+. You can retry later."}
      </Alert>
    );
  }

  return (
    <div>
      {err && <div className="mb-3"><Alert tone="danger">{err}</Alert></div>}
      <div className="space-y-3">
        {scenarios.map((s, i) => (
          <Card key={s.id}>
            <div className="text-xs uppercase tracking-wide text-p-secondary">Scenario {i + 1} of {scenarios.length}</div>
            <p className="mt-2 text-sm text-p-primary">{s.item}</p>
            <p className="mt-1 text-sm text-p-secondary">Annotator&apos;s label: <b className="text-p-primary">{s.submittedLabel}</b>. Is this correct?</p>
            <div className="mt-3 flex gap-2">
              {(["approve", "reject"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVerdicts((p) => ({ ...p, [s.id]: v }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm",
                    verdicts[s.id] === v ? "border-p-accent bg-p-accent-subtle text-p-accent" : "border-p-border text-p-primary hover:border-p-border-focus"
                  )}
                >
                  {v === "approve" ? "Approve (label is correct)" : "Reject (label is wrong)"}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <Button onClick={submit} disabled={!allAnswered || busy}>{busy ? "Scoring…" : "Submit calibration exam"}</Button>
      </div>
    </div>
  );
}
