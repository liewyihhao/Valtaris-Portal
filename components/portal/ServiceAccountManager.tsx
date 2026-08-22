"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { Badge } from "@/components/portal/ui/Badge";
import { postJson } from "@/lib/portal/client";

type Account = {
  id: string;
  name: string;
  description: string | null;
  scopes: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function ServiceAccountManager({ accounts, allScopes }: { accounts: Account[]; allScopes: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
  const [scopes, setScopes] = useState<string[]>([]);

  function toggleScope(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNewKey(null);
    const fd = new FormData(e.currentTarget);
    const { ok, data } = await postJson<{ name?: string; rawKey?: string }>("/api/admin/service-accounts", {
      name: fd.get("name"),
      description: fd.get("description") || undefined,
      scopes,
    });
    setBusy(false);
    if (!ok) { setErr(data.error ?? "Failed to create."); return; }
    setNewKey({ name: data.name ?? "", key: data.rawKey ?? "" });
    setScopes([]);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function revoke(id: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/service-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {newKey && (
        <Alert tone="success" title="API key created — copy it now">
          <p className="text-sm">
            This is the only time <b>{newKey.name}</b>&apos;s key is shown. Store it securely.
          </p>
          <code className="mt-2 block break-all rounded-md bg-p-surface-2 p-2 font-mono text-xs text-p-primary">{newKey.key}</code>
        </Alert>
      )}

      <form onSubmit={onCreate} className="space-y-3">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Name" htmlFor="name" hint="lowercase_with_underscores — becomes the sourceSystem tag">
          <Input id="name" name="name" required placeholder="label_studio" />
        </Field>
        <Field label="Description" htmlFor="description">
          <Input id="description" name="description" placeholder="Label Studio task-engine bridge" />
        </Field>
        <div>
          <div className="mb-1.5 text-sm text-p-secondary">Scopes</div>
          <div className="flex flex-wrap gap-3">
            {allScopes.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-p-primary">
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} className="h-4 w-4 accent-[#5b8def]" />
                <span className="font-mono text-xs">{s}</span>
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={busy || scopes.length === 0}>{busy ? "Creating…" : "Create service account"}</Button>
      </form>

      <div className="space-y-2">
        {accounts.length === 0 && <p className="text-sm text-p-secondary">No service accounts yet.</p>}
        {accounts.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-p-border bg-p-surface-2 p-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-p-primary">{a.name}</span>
                {a.revokedAt ? <Badge intent="danger" icon={false}>Revoked</Badge> : <Badge intent="success" icon={false}>Active</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-p-secondary">
                <span className="font-mono">{a.keyPrefix}…</span> · {a.scopes} · last used {a.lastUsedAt ? new Date(a.lastUsedAt).toLocaleDateString() : "never"}
              </div>
            </div>
            {!a.revokedAt && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => revoke(a.id)}>Revoke</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
