import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = { key: string; label: string };

// Horizontal progress tracker for the applicant funnel. The current step is
// always visually distinct so no one is left wondering where they are.
export function Stepper({ steps, currentKey }: { steps: Step[]; currentKey: string }) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey);
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Application progress">
      {steps.map((step, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
        return (
          <li
            key={step.key}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
              state === "done" && "border-p-accent/30 bg-p-accent-subtle text-p-accent",
              state === "current" && "border-p-accent bg-p-accent text-[#08111f]",
              state === "todo" && "border-p-border bg-p-surface text-p-secondary"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                state === "done" && "bg-p-accent text-[#08111f]",
                state === "current" && "bg-[#08111f] text-p-accent",
                state === "todo" && "bg-p-surface-2 text-p-secondary"
              )}
            >
              {state === "done" ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
            </span>
            <span className="truncate">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
