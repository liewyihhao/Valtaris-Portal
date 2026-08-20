import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/**
 * Public shell for the portal's recruitment + legal pages (how-it-works,
 * legal/*). Intentionally slim — no corporate marketing nav — so the portal
 * stands alone.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-line bg-base/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" aria-label="Valtaris home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
            <Link
              href="/how-it-works"
              className="hidden rounded-full px-3.5 py-2 text-sm text-ink-muted transition-colors hover:text-ink sm:inline-flex"
            >
              How it works
            </Link>
            <Link
              href="/login"
              className="rounded-full px-3.5 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Log in
            </Link>
            <Link href="/apply" className="btn-primary px-4 py-2 text-sm">
              Apply
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-surface/40">
        <div className="container-page flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} Valtaris. All rights reserved.
          </p>
          <nav className="flex gap-5 text-xs text-ink-muted" aria-label="Legal">
            <Link href="/how-it-works" className="hover:text-ink">
              How it works
            </Link>
            <Link href="/legal/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-ink">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
