import type { ReactNode } from "react";
import { Check, Clock, X, AlertTriangle, Info, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BadgeIntent } from "@/lib/portal/labels";

// Status is never color-only: each intent pairs a color with an icon + the text
// label the caller passes in. WCAG + payment-context requirement.
const intentStyles: Record<BadgeIntent, string> = {
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/12 text-warning border-warning/30",
  danger: "bg-danger/12 text-danger border-danger/30",
  info: "bg-info/12 text-info border-info/30",
  neutral: "bg-p-surface-2 text-p-secondary border-p-border",
};

const intentIcon: Record<BadgeIntent, typeof Check> = {
  success: Check,
  warning: Clock,
  danger: X,
  info: Info,
  neutral: Circle,
};

export function Badge({
  intent = "neutral",
  children,
  icon = true,
}: {
  intent?: BadgeIntent;
  children: ReactNode;
  icon?: boolean;
}) {
  const Icon = intent === "warning" ? AlertTriangle : intentIcon[intent];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        intentStyles[intent]
      )}
    >
      {icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}
