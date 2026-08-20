import { cn } from "@/lib/utils";

/**
 * Valtaris brand red — the triangle accent inside the wordmark's "A"s.
 * (Sampled from the supplied logo.)
 */
export const BRAND_RED = "#D11F2C";

/**
 * Compact mark: the signature geometric "A" from VALTARIS with the red
 * triangle accent. Strokes use currentColor so the mark stays legible on
 * any background (white on the dark marketing/portal themes).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-7 w-7 text-ink", className)}
      aria-hidden
    >
      {/* A — two clean angled strokes */}
      <path
        d="M4.5 20.5 L12 3.5 L19.5 20.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* red triangle accent */}
      <path d="M12 10.5 L15.5 17 L8.5 17 Z" fill={BRAND_RED} />
    </svg>
  );
}

/**
 * Full lockup: mark + VALTARIS wordmark set in the site font (Montserrat),
 * all-caps and tracked to echo the supplied logo. Optional tagline.
 */
export function Logo({
  className,
  tagline = false,
}: {
  className?: string;
  tagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-6 w-6" />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold uppercase tracking-[0.16em] text-ink">
          Valtaris
        </span>
        {tagline && (
          <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.28em] text-ink-muted">
            Making AI Smarter
          </span>
        )}
      </span>
    </span>
  );
}
