import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-p-border bg-p-surface p-6", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-semibold text-p-primary">{title}</h3>
        {description && <p className="mt-1 text-sm text-p-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-p-border bg-p-surface p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-p-primary">{value}</div>
      {sub && <div className="mt-1 text-sm text-p-secondary">{sub}</div>}
    </div>
  );
}
