"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

// Each option encodes a qualified worker + track the admin can grant validator on.
export function GrantValidatorForm({ options }: { options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function grant() {
    if (!value) return;
    const [userId, trackId] = value.split(":");
    setBusy(true);
    setErr(null);
    setOk(null);
    const { ok: success, data } = await postJson("/api/admin/validators", { userId, trackId });
    setBusy(false);
    if (!success) { setErr(data.error ?? "Failed to grant."); return; }
    setOk("Validator role assigned.");
    setValue("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {err && <Alert tone="danger">{err}</Alert>}
      {ok && <Alert tone="success">{ok}</Alert>}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64">
          <label className="mb-1 block text-xs text-p-secondary">Assign validator role to</label>
          <Select value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select a qualified worker + track…</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <Button size="sm" disabled={busy || !value} onClick={grant}>Grant validator</Button>
      </div>
    </div>
  );
}
