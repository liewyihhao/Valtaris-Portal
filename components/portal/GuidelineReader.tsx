"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";

export function GuidelineReader({
  trackId,
  guidelineVersionId,
  version,
  content,
}: {
  trackId: string;
  guidelineVersionId: string;
  version: number;
  content: string;
}) {
  const router = useRouter();
  const [scrolledEnd, setScrolledEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolledEnd(true);
  }

  async function acknowledge() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/apply/guidelines/${trackId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guidelineVersionId }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Could not record your acknowledgment.");
      return;
    }
    router.push("/apply/agreements");
    router.refresh();
  }

  return (
    <div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-p-border bg-p-surface p-6 text-sm leading-relaxed text-p-primary"
      >
        {content}
      </div>

      {!scrolledEnd && (
        <p className="mt-3 text-xs text-p-secondary">Scroll to the bottom to enable the acknowledgment.</p>
      )}
      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}

      <label className="mt-4 flex items-center gap-2.5 text-sm text-p-primary">
        <input
          type="checkbox"
          disabled={!scrolledEnd}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="h-4 w-4 accent-[#5b8def] disabled:opacity-40"
        />
        I&apos;ve read and understood these guidelines (v{version}).
      </label>

      <div className="mt-5">
        <Button onClick={acknowledge} disabled={!checked || submitting}>
          {submitting ? "Saving…" : "Continue →"}
        </Button>
      </div>
    </div>
  );
}
