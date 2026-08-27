"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Scale,
  UserCircle,
  ClipboardCheck,
  ShieldCheck,
  BarChart3,
  Bell,
  LifeBuoy,
  GraduationCap,
  MailCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/Logo";

type NavItem = { href: string; label: string; icon: typeof Wallet };

const applicantNav: NavItem[] = [
  { href: "/apply", label: "Application", icon: ClipboardCheck },
  { href: "/learn", label: "Learning Center", icon: GraduationCap },
];

const annotatorNav: NavItem[] = [
  { href: "/dashboard", label: "Task hub", icon: LayoutDashboard },
  { href: "/invitations", label: "Invitations", icon: MailCheck },
  { href: "/validate", label: "Validate", icon: ShieldCheck },
  { href: "/my-work", label: "My work", icon: BarChart3 },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/payment-details", label: "Payment details", icon: CreditCard },
  { href: "/appeals", label: "Appeals", icon: Scale },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile & tracks", icon: UserCircle },
  { href: "/help", label: "Help", icon: LifeBuoy },
];

export function PortalNav({
  role,
  email,
  approved,
  isValidator,
  unread,
}: {
  role: string;
  email: string;
  approved: boolean;
  isValidator?: boolean;
  unread?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Approved annotators get the working nav; applicants get the funnel link.
  // The Validate item only appears with an active ValidatorCapability.
  const items = (approved ? annotatorNav : applicantNav).filter(
    (i) => i.href !== "/validate" || isValidator
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-p-border px-4 py-3 md:hidden">
        <Link href={approved ? "/dashboard" : "/apply"} className="inline-flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="font-semibold text-p-primary">Valtaris</span>
        </Link>
        <button onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" className="text-p-secondary">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <nav
        className={cn(
          "flex-col gap-1 border-r border-p-border bg-p-surface p-4 md:flex md:w-60 md:shrink-0",
          open ? "flex" : "hidden"
        )}
      >
        <Link
          href={approved ? "/dashboard" : "/apply"}
          className="mb-6 hidden items-center gap-2.5 px-2 md:flex"
        >
          <LogoMark />
          <span className="text-lg font-semibold tracking-tight text-p-primary">Valtaris</span>
        </Link>

        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-p-accent-subtle text-p-accent"
                  : "text-p-secondary hover:bg-p-surface-2 hover:text-p-primary"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.href === "/notifications" && !!unread && unread > 0 && (
                <span className="rounded-full bg-p-accent px-1.5 text-[10px] font-semibold text-[#08111f]">{unread}</span>
              )}
            </Link>
          );
        })}

        {(role === "ops" || role === "admin" || role === "project_manager" || role === "internal") && (
          <Link
            href="/admin/home"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-warning hover:bg-p-surface-2"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            Ops console
          </Link>
        )}

        <div className="mt-auto border-t border-p-border pt-4">
          <div className="truncate px-3 text-xs text-p-secondary" title={email}>{email}</div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-p-secondary hover:bg-p-surface-2 hover:text-p-primary"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
