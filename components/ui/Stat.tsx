import { cn } from "@/lib/utils";

type StatProps = {
  value: string;
  label: string;
  placeholder?: boolean;
  className?: string;
};

export function Stat({ value, label, placeholder, className }: StatProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold text-ink sm:text-4xl">
          {value}
        </span>
        {placeholder && (
          <span
            className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint"
            title="Placeholder — replace with a verified figure"
          >
            TBD
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-muted">{label}</p>
    </div>
  );
}
