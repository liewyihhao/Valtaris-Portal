"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Field, Input } from "@/components/portal/ui/Field";
import { Alert } from "@/components/portal/ui/Alert";
import { postJson } from "@/lib/portal/client";

export type TalentRow = {
  id: string;
  name: string;
  email: string;
  country: string;
  status: string;
  tiers: { track: string; tier: string }[];
  languages: string[];
  surge: boolean;
  kyc: string;
  accuracy: number | null;
};

const KYC_INTENT: Record<string, "success" | "warning" | "neutral"> = {
  id_biometric: "success",
  email_phone: "warning",
  none: "neutral",
};

export function TalentSelection({ rows }: { rows: TalentRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCohort, setShowCohort] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [clientName, setClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function exportCsv() {
    const chosen = rows.filter((r) => selected.has(r.id));
    const header = ["name", "email", "country", "status", "tiers", "languages", "surge", "kyc", "accuracy"];
    const lines = [header.join(",")].concat(
      chosen.map((r) =>
        [
          r.name, r.email, r.country, r.status,
          r.tiers.map((t) => `${t.track}:${t.tier}`).join(" | "),
          r.languages.join(" "), r.surge ? "yes" : "no", r.kyc, r.accuracy ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talent-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createCohort() {
    if (cohortName.trim().length < 3) { setMsg("Give the cohort a name."); return; }
    setBusy(true);
    setMsg(null);
    const { ok, data } = await postJson<{ id: string }>("/api/admin/cohorts", {
      name: cohortName,
      clientName: clientName || null,
      userIds: [...selected],
    });
    setBusy(false);
    if (!ok) { setMsg(data.error ?? "Could not create cohort."); return; }
    router.push(`/admin/cohorts/${data.id}`);
    router.refresh();
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-p-accent/30 bg-p-accent-subtle px-4 py-2.5">
          <span className="text-sm font-medium text-p-accent">{selected.size} selected</span>
          <Button size="sm" onClick={() => setShowCohort((v) => !v)}>Create cohort</Button>
          <Button size="sm" variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <button className="text-xs text-p-secondary hover:text-p-primary" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {showCohort && selected.size > 0 && (
        <div className="mb-3 rounded-lg border border-p-border bg-p-surface p-4">
          {msg && <div className="mb-3"><Alert tone="danger">{msg}</Alert></div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cohort name"><Input value={cohortName} onChange={(e) => setCohortName(e.target.value)} placeholder="e.g. Client A — Spanish surge" /></Field>
            <Field label="Client (optional)"><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client A" /></Field>
          </div>
          <Button size="sm" onClick={createCohort} disabled={busy}>{busy ? "Creating…" : `Create cohort with ${selected.size}`}</Button>
        </div>
      )}

      <Table>
        <THead>
          <TH><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="h-4 w-4 accent-[#5b8def]" /></TH>
          <TH>Annotator</TH><TH>Tiers</TH><TH>Languages</TH><TH>Region</TH><TH>Accuracy</TH><TH>KYC</TH><TH></TH>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={8}>No annotators match these filters.</EmptyRow>}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.email}`} className="h-4 w-4 accent-[#5b8def]" /></TD>
              <TD>
                <div className="font-medium text-p-primary">{r.name}</div>
                <div className="text-xs text-p-secondary">{r.email}{r.status !== "active" ? ` · ${r.status}` : ""}</div>
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {r.tiers.map((t, i) => <Badge key={i} intent="info" icon={false}>{t.track} · {t.tier}</Badge>)}
                </div>
              </TD>
              <TD className="text-xs text-p-secondary">{r.languages.join(", ")}{r.surge ? " · surge" : ""}</TD>
              <TD className="text-p-secondary">{r.country}</TD>
              <TD className="tabular-nums text-p-primary">{r.accuracy !== null ? `${Math.round(r.accuracy * 100)}%` : "—"}</TD>
              <TD><Badge intent={KYC_INTENT[r.kyc] ?? "neutral"} icon={false}>{r.kyc.replace("_", "+")}</Badge></TD>
              <TD className="text-right"><Link href={`/admin/talent/${r.id}`} className="text-sm text-p-accent hover:underline">View →</Link></TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
