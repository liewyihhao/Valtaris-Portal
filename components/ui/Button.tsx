import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
  withArrow?: boolean;
};

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
  withArrow = false,
}: ButtonLinkProps) {
  const external = href.startsWith("http");
  const content = (
    <>
      {children}
      {withArrow && <ArrowRight className="h-4 w-4" aria-hidden />}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        className={cn(variantClass[variant], className)}
        target="_blank"
        rel="noreferrer noopener"
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={cn(variantClass[variant], className)}>
      {content}
    </Link>
  );
}
