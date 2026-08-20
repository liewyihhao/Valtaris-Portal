"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Button } from "@/components/portal/ui/Button";
import { Badge } from "@/components/portal/ui/Badge";
import { Field, Input, Select } from "@/components/portal/ui/Field";
import { Alert } from "@/components/portal/ui/Alert";
import { Table, THead, TH, TBody, TR, TD } from "@/components/portal/ui/Table";
import { AGREEMENT_DOCS, type AgreementKey } from "@/lib/portal/agreements-content";
import { COUNTRIES } from "@/lib/portal/options";
import { postJson } from "@/lib/portal/client";

const KEYS: AgreementKey[] = ["contractor", "nda", "tos"];

export function AgreementsFlow({ defaultCountry }: { defaultCountry: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<AgreementKey | null>(null);
  const [signed, setSigned] = useState<Record<AgreementKey, boolean>>({
    contractor: false,
    nda: false,
    tos: false,
  });
  const [signatureName, setSignatureName] = useState("");
  const isUS = defaultCountry === "United States";
  const [taxType, setTaxType] = useState<"tax_w9" | "tax_w8ben">(isUS ? "tax_w9" : "tax_w8ben");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [residence, setResidence] = useState(defaultCountry);
  const [taxDone, setTaxDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allSigned = KEYS.every((k) => signed[k]) && taxDone && signatureName.trim().length >= 2;

  async function finish() {
    setSubmitting(true);
    setError(null);
    const { ok, data } = await postJson("/api/apply/agreements", {
      signatureName,
      taxFormType: taxType,
      taxData: { legalName, taxId, countryOfResidence: residence },
    });
    setSubmitting(false);
    if (!ok) {
      setError(data.error ?? "Could not finalise. Please complete every item.");
      return;
    }
    router.push("/apply/approved");
    router.refresh();
  }

  return (
    <div>
      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}

      <Card>
        <Field label="Full legal name (used as your e-signature for all documents)" htmlFor="sig">
          <Input id="sig" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="e.g. Maria Santos" />
        </Field>

        <Table className="mt-2">
          <THead><TH>Document</TH><TH>Status</TH><TH></TH></THead>
          <TBody>
            {KEYS.map((k) => (
              <TR key={k}>
                <TD>{AGREEMENT_DOCS[k].title}</TD>
                <TD>{signed[k] ? <Badge intent="success">Signed</Badge> : <Badge intent="neutral">Not signed</Badge>}</TD>
                <TD className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => setOpen(k)}>Review &amp; sign</Button>
                </TD>
              </TR>
            ))}
            <TR>
              <TD>Tax form ({taxType === "tax_w9" ? "W-9" : "W-8BEN"})</TD>
              <TD>{taxDone ? <Badge intent="success">Submitted</Badge> : <Badge intent="neutral">Not submitted</Badge>}</TD>
              <TD className="text-right">
                <Button variant="secondary" size="sm" onClick={() => setOpen("__tax__" as AgreementKey)}>Fill out</Button>
              </TD>
            </TR>
          </TBody>
        </Table>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-p-secondary">All four required before payout can be enabled.</span>
          <Button onClick={finish} disabled={!allSigned || submitting}>{submitting ? "Finalising…" : "Finish →"}</Button>
        </div>
      </Card>

      {/* Document modal */}
      {open && open !== ("__tax__" as AgreementKey) && (
        <Modal onClose={() => setOpen(null)} title={AGREEMENT_DOCS[open].title}>
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-p-border bg-p-surface-2 p-4 text-sm text-p-primary">
            {AGREEMENT_DOCS[open].body}
          </div>
          <p className="mt-3 text-xs text-p-secondary">Signing as: <b className="text-p-primary">{signatureName || "— enter your name first —"}</b></p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(null)}>Close</Button>
            <Button size="sm" disabled={signatureName.trim().length < 2} onClick={() => { setSigned((s) => ({ ...s, [open]: true })); setOpen(null); }}>
              Sign this document
            </Button>
          </div>
        </Modal>
      )}

      {/* Tax modal */}
      {open === ("__tax__" as AgreementKey) && (
        <Modal onClose={() => setOpen(null)} title="Tax information">
          <Field label="Form type">
            <Select value={taxType} onChange={(e) => setTaxType(e.target.value as "tax_w9" | "tax_w8ben")}>
              <option value="tax_w9">W-9 (US persons)</option>
              <option value="tax_w8ben">W-8BEN (non-US persons)</option>
            </Select>
          </Field>
          <Field label="Legal name"><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} /></Field>
          <Field label={taxType === "tax_w9" ? "Taxpayer ID (SSN/EIN)" : "Foreign tax ID"} hint="(demo stores only the last 4)">
            <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </Field>
          <Field label="Country of residence">
            <Select value={residence} onChange={(e) => setResidence(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(null)}>Close</Button>
            <Button size="sm" disabled={legalName.trim().length < 2 || taxId.trim().length < 1} onClick={() => { setTaxDone(true); setOpen(null); }}>
              Submit tax form
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-p-border bg-p-surface p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-p-primary">{title}</h3>
        {children}
      </div>
    </div>
  );
}
