"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Field, Input } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

function SetupForm() {
  const params = useSearchParams();
  const credId = params.get("cred") ?? "";
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const missing = !credId || !token;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { ok, data } = await postJson<{ username?: string }>("/api/project-access/setup", {
      credId,
      token,
      password: fd.get("password"),
    });
    setLoading(false);
    if (!ok) { setError(data.error ?? "Something went wrong."); return; }
    setUsername(data.username ?? "your project login");
  }

  if (missing) {
    return <Card><h1 className="text-xl font-semibold text-p-primary">Invalid setup link</h1><p className="mt-2 text-sm text-p-secondary">Use the link from your project-access email.</p></Card>;
  }

  if (username) {
    return (
      <Card>
        <Alert tone="success" title="Project login ready">
          <p className="text-sm">Your project username is <span className="font-mono text-p-primary">{username}</span>. Use your new password to enter the project.</p>
        </Alert>
        <Link href="/projects" className="mt-4 inline-block"><Button size="sm">Go to Projects</Button></Link>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-p-accent">Project access</p>
      <h1 className="mt-1 text-xl font-semibold text-p-primary">Set up your project login</h1>
      <p className="mt-1 mb-5 text-sm text-p-secondary">
        Verify and choose a password for this project. You&apos;ll use it to enter the project workspace.
      </p>
      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
      <form onSubmit={onSubmit}>
        <Field label="Project password" htmlFor="password" hint="(min 8 characters)">
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={loading} className="w-full">{loading ? "Setting up…" : "Set up project login"}</Button>
      </form>
    </Card>
  );
}

export default function ProjectSetupPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <Suspense fallback={null}>
        <SetupForm />
      </Suspense>
    </div>
  );
}
