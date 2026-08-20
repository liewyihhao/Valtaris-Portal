import type { ReactNode } from "react";
import { Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "success" | "danger";

const tones: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-info/30 bg-info/10 text-info", Icon: Info },
  warning: { cls: "border-warning/30 bg-warning/10 text-warning", Icon: AlertTriangle },
  success: { cls: "border-success/30 bg-success/10 text-success", Icon: CheckCircle2 },
  danger: { cls: "border-danger/30 bg-danger/10 text-danger", Icon: XCircle },
};

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  const { cls, Icon } = tones[tone];
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", cls)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="text-p-primary">
        {title && <div className={cn("font-semibold", cls.split(" ").pop())}>{title}</div>}
        {children && <div className="text-p-secondary">{children}</div>}
      </div>
    </div>
  );
}

// A clearly-marked placeholder banner for legal/stub content.
export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-4 py-3 text-xs text-warning">
      ⚠ PLACEHOLDER — {children}
    </div>
  );
}
