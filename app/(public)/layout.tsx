import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/**
 * Slim shell for the portal's few standalone pages (legal/*, public certificate
 * verification). The Portal is an internal ops + workforce tool with no public
 * marketing face — public recruitment lives in the separate marketing website —
 * so this shell is just a logo + a Log in link, no marketing nav.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-line bg-base/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" aria-label="Valtaris">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
            <Link
              href="/login"
              className="rounded-full px-3.5 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Log in
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
