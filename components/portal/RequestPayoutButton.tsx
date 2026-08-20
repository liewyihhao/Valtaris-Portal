"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/Button";
import { postJson } from "@/lib/portal/client";

export function RequestPayoutButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function request() {
    setLoading(true);
    setMsg(null);
    const { ok, data } = await postJson<{ paid: number }>("/api/payouts/request");
    setLoading(false);
    if (!ok) {
      setMsg(data.error ?? "Could not request payout.");
      return;
    }
    setMsg(`Payout requested: ${data.paid} item(s).`);
    router.refresh();
  }

  return (
    <div className="text-right">
      <Button onClick={request} disabled={disabled || loading}>
        {loading ? "Requesting…" : "Request payout"}
      </Button>
      {msg && <p className="mt-2 text-xs text-p-secondary">{msg}</p>}
    </div>
  );
}
