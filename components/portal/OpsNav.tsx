"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Inbox, Users, DollarSign, HelpCircle, FileText, Boxes, LogOut, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/Logo";

const items = [
  { href: "/admin", label: "Review queue", icon: Inbox },
  { href: "/admin/workers", label: "Worker pool", icon: Users },
  { href: "/admin/rate-cards", label: "Rate cards", icon: DollarSign },
  { href: "/admin/questions", label: "Question banks", icon: HelpCircle },
  { href: "/admin/guidelines", label: "Guidelines", icon: FileText },
  { href: "/admin/label-studio", label: "Label Studio", icon: Boxes },
];

export function OpsNav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex w-full flex-row gap-1 overflow-x-auto border-b border-p-border bg-p-surface p-3 md:w-60 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-4">
      <Link href="/admin" className="mb-4 hidden items-center gap-2.5 px-2 md:flex">
        <LogoMark />
        <span className="text-sm font-semibold tracking-tight text-p-primary">Valtaris Ops</span>
      </Link>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-p-accent-subtle text-p-accent" : "text-p-secondary hover:bg-p-surface-2 hover:text-p-primary"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto hidden border-t border-p-border pt-4 md:block">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-p-secondary hover:bg-p-surface-2">
          <ArrowLeft className="h-4 w-4" /> Annotator view
        </Link>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-p-secondary hover:bg-p-surface-2">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <div className="truncate px-3 pt-2 text-xs text-p-disabled">{email}</div>
      </div>
    </nav>
  );
}
