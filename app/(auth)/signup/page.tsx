"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/portal/ui/Card";
import { Field, Input, Select } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { COUNTRIES, LANGUAGES } from "@/lib/portal/options";
import { postJson } from "@/lib/portal/client";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: fd.get("email"),
      password: fd.get("password"),
      country: fd.get("country"),
      primaryLanguage: fd.get("primaryLanguage"),
      consent: fd.get("consent") === "on",
    };
    const { ok, data } = await postJson<{ verifyUrl?: string }>("/api/signup", payload);
    setLoading(false);
    if (!ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setVerifyUrl(data.verifyUrl ?? null);
  }

  if (verifyUrl) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-p-primary">Verify your email</h1>
        <p className="mt-2 text-sm text-p-secondary">
          We&apos;ve created your account. Normally you&apos;d get a verification link by
          email — since this is a local demo, use the link below.
        </p>
        <Alert tone="info" title="Development mode">
          <a href={verifyUrl} className="break-all text-p-accent underline">
            Click to verify your email →
          </a>
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-p-primary">Create your account</h1>
      <p className="mt-1 mb-5 text-sm text-p-secondary">
        Four fields, under a minute. You&apos;ll qualify before any paid work.
      </p>
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <form onSubmit={onSubmit}>
        <Field label="Email address" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="password" hint="(min 8 characters)">
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="Country" htmlFor="country">
          <Select id="country" name="country" required defaultValue="">
            <option value="" disabled>Select country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Primary language" htmlFor="primaryLanguage">
          <Select id="primaryLanguage" name="primaryLanguage" required defaultValue="">
            <option value="" disabled>Select language</option>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
        <label className="mb-5 flex items-start gap-2.5 text-sm text-p-secondary">
          <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-[#5b8def]" />
          <span>
            I agree to the{" "}
            <Link href="/legal/privacy" className="text-p-accent hover:underline">Privacy Policy</Link>{" "}
            (required)
          </span>
        </label>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-p-secondary">
        Already have an account?{" "}
        <Link href="/login" className="text-p-accent hover:underline">Log in</Link>
      </p>
    </Card>
  );
}
