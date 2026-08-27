"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card } from "@/components/portal/ui/Card";
import { Field, Input } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Default to the smart root, which routes each role to its home
  // (staff → /admin/home, applicant → /apply, annotator → /dashboard).
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const verified = params.get("verified") === "1";
  const tokenError = params.get("error") === "invalid_token";
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
    setLoading(false);
    if (res?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-p-accent">Valtaris Annotator Network</p>
      <h1 className="mt-1 text-xl font-semibold text-p-primary">Annotator sign in</h1>
      <p className="mt-1 mb-5 text-sm text-p-secondary">Welcome back — sign in to work, track earnings, and request payouts.</p>

      {verified && (
        <div className="mb-4">
          <Alert tone="success" title="Email verified">You can log in now.</Alert>
        </div>
      )}
      {tokenError && (
        <div className="mb-4">
          <Alert tone="danger">That verification link was invalid or expired.</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <Field label="Email address" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </Field>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Login"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-p-secondary">
        New here?{" "}
        <Link href="/signup" className="text-p-accent hover:underline">Create an account</Link>
      </p>
      <p className="mt-6 text-center text-[11px] text-p-disabled">
        <Link href="/staff/login" className="hover:text-p-secondary hover:underline">Staff sign-in</Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
