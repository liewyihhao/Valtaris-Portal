"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession, signOut } from "next-auth/react";
import { Card } from "@/components/portal/ui/Card";
import { Field, Input } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";

// Staff/admin roles allowed through this entrance (mirrors lib/portal/session
// STAFF_ROLES; kept inline because this is a client component).
const STAFF_ROLES = ["ops", "admin", "project_manager", "internal"];

function StaffLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Return to a deep-linked admin page if we came from one; else the ops home.
  const cb = params.get("callbackUrl");
  const dest = cb && cb.startsWith("/admin") ? cb : "/admin/home";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    if (res?.error) {
      setLoading(false);
      setError("Incorrect email or password.");
      return;
    }
    // Staff-only entrance: reject a valid non-staff account rather than logging
    // it into the ops console.
    const session = await getSession();
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!role || !STAFF_ROLES.includes(role)) {
      await signOut({ redirect: false });
      setLoading(false);
      setError("This account doesn’t have staff access. Use the annotator sign-in.");
      return;
    }
    router.push(dest);
    router.refresh();
  }

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-p-accent">Valtaris Ops</p>
      <h1 className="mt-1 text-xl font-semibold text-p-primary">Staff &amp; admin sign in</h1>
      <p className="mt-1 mb-5 text-sm text-p-secondary">
        For the internal operations console — application review, project setup, payouts, trust &amp; safety.
      </p>

      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <Field label="Work email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </Field>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in to Ops"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-p-secondary">
        Are you an annotator?{" "}
        <Link href="/login" className="text-p-accent hover:underline">Annotator sign-in</Link>
      </p>
    </Card>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={null}>
      <StaffLoginForm />
    </Suspense>
  );
}
