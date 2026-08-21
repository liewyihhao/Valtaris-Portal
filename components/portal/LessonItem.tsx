"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/portal/client";

type Lesson = {
  id: string;
  title: string;
  content: string;
  hasKnowledgeCheck: boolean;
  checkPrompt: string | null;
  checkOptions: string[] | null;
  checkCorrect: number | null;
  done: boolean;
};

export function LessonItem({ lesson }: { lesson: Lesson }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function markDone() {
    setBusy(true);
    await postJson(`/api/learn/${lesson.id}`, {});
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-p-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px]", lesson.done ? "bg-success/20 text-success" : "bg-p-surface-2 text-p-secondary")}>
          {lesson.done ? "✓" : "•"}
        </span>
        <span className="flex-1 text-sm font-medium text-p-primary">{lesson.title}</span>
        <span className="text-xs text-p-secondary">{open ? "Hide" : "Open"}</span>
      </button>
      {open && (
        <div className="border-t border-p-border px-4 py-4">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-p-primary">{lesson.content}</div>
          {lesson.hasKnowledgeCheck && lesson.checkPrompt && lesson.checkOptions && (
            <div className="mt-4 rounded-lg border border-p-border bg-p-surface-2 p-3">
              <div className="text-xs uppercase tracking-wide text-p-secondary">Knowledge check (for practice — doesn&apos;t affect your tier)</div>
              <p className="mt-1 text-sm text-p-primary">{lesson.checkPrompt}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {lesson.checkOptions.map((o, i) => (
                  <button
                    key={i}
                    onClick={() => setPicked(i)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-left text-sm",
                      picked === null ? "border-p-border text-p-primary"
                        : i === lesson.checkCorrect ? "border-success/40 bg-success/10 text-success"
                        : picked === i ? "border-danger/40 bg-danger/10 text-danger" : "border-p-border text-p-secondary"
                    )}
                  >
                    {o}{picked !== null && i === lesson.checkCorrect ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!lesson.done && (
            <button onClick={markDone} disabled={busy} className="mt-4 rounded-lg bg-p-accent px-4 py-2 text-sm font-semibold text-[#08111f] disabled:opacity-50">
              {busy ? "Saving…" : "Mark lesson complete"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
