"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Field, Input, Select } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { key: "payoneer", label: "Payoneer", note: "Primary — 150+ countries" },
  { key: "wise", label: "Wise", note: "Mid-market FX, visible fees" },
  { key: "bank_transfer", label: "Bank transfer", note: "Fallback" },
] as const;

export function PaymentDetailsForm({
  current,
}: {
  current: { provider: string; accountRef: string; currency: string; reverifying: boolean } | null;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<string>(current?.provider ?? "payoneer");
  const [accountRef, setAccountRef] = useState("");
  const [currency, setCurrency] = useState(current?.currency ?? "USD");
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { ok, data } = await postJson<{ reverifying?: boolean }>("/api/payment-details", {
      provider,
      accountRef,
      currency,
    });
    setSaving(false);
    if (!ok) {
      setMsg({ tone: "danger", text: data.error ?? "Could not save." });
      return;
    }
    setMsg({
      tone: data.reverifying ? "info" : "success",
      text: data.reverifying
        ? "Saved — we're verifying this change before it takes effect (a brief hold)."
        : "Payout method saved and verified.",
    });
    router.refresh();
  }

  return (
    <Card className="max-w-lg">
      {current?.reverifying && (
        <div className="mb-4"><Alert tone="info" title="Verifying a recent change">Payouts are paused briefly while we verify your updated details.</Alert></div>
      )}
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

      <form onSubmit={save}>
        <div className="mb-4">
          <div className="mb-1.5 text-sm font-medium text-p-primary">Payout method</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <button
                type="button"
                key={p.key}
                onClick={() => setProvider(p.key)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-sm",
                  provider === p.key ? "border-p-accent bg-p-accent-subtle text-p-accent" : "border-p-border text-p-primary hover:border-p-border-focus"
                )}
              >
                <div className="font-medium">{p.label}</div>
                <div className="text-xs text-p-secondary">{p.note}</div>
              </button>
            ))}
          </div>
        </div>

        <Field label={provider === "bank_transfer" ? "IBAN / account number" : "Account email / ID"} htmlFor="acct">
          <Input id="acct" value={accountRef} onChange={(e) => setAccountRef(e.target.value)} placeholder={current ? `Current: ${current.accountRef}` : ""} required />
        </Field>
        <Field label="Currency preference" htmlFor="cur">
          <Select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {["USD", "EUR", "GBP", "MYR", "INR", "PHP", "IDR", "BRL"].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>

        <Alert tone="info" title="Fee shown before you confirm">
          ~$1.50 flat + 0% FX markup (Payoneer, mid-market rate). No surprise deductions.
        </Alert>

        <div className="mt-4">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save payment method"}</Button>
        </div>
        <p className="mt-3 text-xs text-p-secondary">Changing payout details triggers a short re-verification step (fraud control) before it takes effect.</p>
      </form>
    </Card>
  );
}
