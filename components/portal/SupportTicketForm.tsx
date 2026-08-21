"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

const CATS = [
  ["payout_issue", "Payout issue"],
  ["exam_dispute", "Exam dispute"],
  ["account_access", "Account access"],
  ["technical_bug", "Technical bug"],
  ["policy_question", "Policy question"],
  ["other", "Other"],
] as const;

export function SupportTicketForm() {
  const router = useRouter();
  const [category, setCategory] = useState("payout_issue");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    const { ok, data } = await postJson("/api/support", {
      category, subject: fd.get("subject"), body: fd.get("body"),
    });
    setBusy(false);
    if (!ok) { setMsg({ tone: "danger", text: data.error ?? "Could not submit." }); return; }
    setMsg({ tone: "success", text: "Ticket submitted — we'll follow up per the SLA." });
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <Field label="Category">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </Field>
      {category === "exam_dispute" && (
        <div className="mb-4">
          <Alert tone="info" title="Exam & payout disputes use the appeal flow">
            For a specific rejected payout, please <Link href="/earnings" className="text-p-accent underline">open an appeal from Earnings</Link> — it&apos;s
            tied to the reason code and has a published SLA. Use a ticket only for something the appeal flow doesn&apos;t cover.
          </Alert>
        </div>
      )}
      <Field label="Subject" htmlFor="subject"><Input id="subject" name="subject" required /></Field>
      <Field label="Details" htmlFor="body"><Textarea id="body" name="body" required /></Field>
      <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit ticket"}</Button>
    </form>
  );
}
