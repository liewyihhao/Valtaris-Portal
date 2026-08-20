"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Field, Select } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { COUNTRIES } from "@/lib/portal/options";
import { postJson } from "@/lib/portal/client";

export default function EligibilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFailure(null);
    const fd = new FormData(e.currentTarget);
    const { ok, data } = await postJson<{ passed: boolean; reason?: string }>("/api/apply/eligibility", {
      ageConfirmed: fd.get("age") === "yes",
      region: fd.get("region"),
      deviceType:
        typeof navigator !== "undefined" && /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop",
    });
    setLoading(false);
    if (!ok) {
      setFailure(data.error ?? "Could not check eligibility.");
      return;
    }
    if (data.passed) {
      router.push("/apply/questionnaire");
      router.refresh();
    } else {
      setFailure(data.reason ?? "You're not currently eligible.");
    }
  }

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">Step 1 · Eligibility</div>
      <h1 className="mt-1 text-2xl font-semibold text-p-primary">Quick eligibility check</h1>
      <p className="mt-1 text-sm text-p-secondary">A fast pass/fail gate before the longer steps.</p>

      <Card className="mt-6">
        {failure && (
          <div className="mb-4">
            <Alert tone="danger" title="Not eligible right now">{failure}</Alert>
          </div>
        )}
        <form onSubmit={onSubmit}>
          <Field label="Are you 18 years or older?" htmlFor="age">
            <Select id="age" name="age" required defaultValue="">
              <option value="" disabled>Select…</option>
              <option value="yes">Yes, I&apos;m 18 or older</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <Field label="Which country/region are you in?" htmlFor="region">
            <Select id="region" name="region" required defaultValue="">
              <option value="" disabled>Select region</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <p className="mb-5 text-xs text-p-secondary">
            Your device type is detected automatically. Some task types require a desktop.
          </p>
          <Button type="submit" disabled={loading}>{loading ? "Checking…" : "Continue →"}</Button>
        </form>
      </Card>
    </div>
  );
}
