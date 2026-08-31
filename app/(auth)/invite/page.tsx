"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Field, Input } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

function InviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const missing = !email || !token;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { ok, data } = await postJson("/api/invite/complete", {
      email,
      token,
      fullName: fd.get("fullName"),
      password: fd.get("password"),
    });
    setLoading(false);
    if (!ok) { setError(data.error ?? "Something went wrong."); return; }
    setDone(true);
    setTimeout(() => router.push("/login?verified=1"), 1200);
  }

  if (missing) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-p-primary">Invalid invite link</h1>
        <p className="mt-2 text-sm text-p-secondary">This link is missing information. Please use the link from your approval email.</p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <Alert tone="success" title="Account created">Your account is ready. Taking you to sign in…</Alert>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-p-accent">Valtaris Annotator Network</p>
      <h1 className="mt-1 text-xl font-semibold text-p-primary">Set up your account</h1>
      <p className="mt-1 mb-5 text-sm text-p-secondary">
        You were approved to join. Set a display name and password for <span className="text-p-primary">{email}</span>.
      </p>
      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
      <form onSubmit={onSubmit}>
        <Field label="Display name" htmlFor="fullName">
          <Input id="fullName" name="fullName" type="text" required autoComplete="name" />
        </Field>
        <Field label="Password" htmlFor="password" hint="(min 8 characters)">
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-p-secondary">
        Already set up? <Link href="/login" className="text-p-accent hover:underline">Log in</Link>
      </p>
    </Card>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteForm />
    </Suspense>
  );
}
