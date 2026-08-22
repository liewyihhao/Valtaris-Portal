import Link from "next/link";
import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { StatCard, Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { formatMoney } from "@/lib/portal/labels";
import { TAX_1099_THRESHOLD_USD, KYC_LABEL, DORMANCY_WARN_MONTHS, SANCTIONS_RESCREEN_DAYS, type KycLevel } from "@/lib/portal/constants";
import { needsRescreen } from "@/lib/portal/screening";
import { laborRiskFor, LABOR_RISK_INTENT, type LaborRisk } from "@/lib/portal/labor";

export default async function CompliancePage() {
  await requireCapability("compliance_ops");

  const annotators = await prisma.user.findMany({
    where: { role: "annotator" },
    include: { trustProfile: true, taxProfile: true, payouts: { where: { status: "paid" } } },
  });

  const kycCounts: Record<string, number> = { none: 0, email_phone: 0, id_biometric: 0 };
  let sanctionsFlagged = 0, taxIncomplete = 0, rescreenDue = 0;
  const watchlist: { id: string; name: string; ytd: number; taxOk: boolean }[] = [];
  const taxIncompleteList: { id: string; name: string; country: string }[] = [];
  // Active-workforce headcount per recruiting country → labor-classification checklist.
  const countryCounts: Record<string, number> = {};

  for (const u of annotators) {
    const lvl = u.trustProfile?.kycLevel ?? "none";
    kycCounts[lvl] = (kycCounts[lvl] ?? 0) + 1;
    if (u.trustProfile?.sanctionsStatus === "flagged") sanctionsFlagged += 1;
    if (needsRescreen(u.trustProfile?.sanctionsCheckedAt)) rescreenDue += 1;
    const taxOk = !!u.taxProfile?.completedAt;
    if (!taxOk) { taxIncomplete += 1; taxIncompleteList.push({ id: u.id, name: u.fullName ?? u.email, country: u.country }); }
    const ytd = u.payouts.reduce((s, p) => s + p.grossAmount, 0);
    if (ytd >= TAX_1099_THRESHOLD_USD) watchlist.push({ id: u.id, name: u.fullName ?? u.email, ytd, taxOk });
    countryCounts[u.country] = (countryCounts[u.country] ?? 0) + 1;
  }

  // Labor-classification checklist rows, high-risk first, then by headcount.
  const RISK_ORDER: Record<LaborRisk, number> = { high: 0, medium: 1, low: 2 };
  const laborRows = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count, ...laborRiskFor(country) }))
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.count - a.count);

  const dormant = await prisma.user.findMany({
    where: { role: "applicant", status: { in: ["dormant"] } },
    select: { id: true, email: true, lastActiveAt: true, dormantNotifiedAt: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Compliance</h1>
      <p className="mt-1 text-sm text-p-secondary">Verification, sanctions, tax, 1099 reporting, and data-lifecycle status.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="ID+biometric verified" value={String(kycCounts.id_biometric)} sub="T3 / sensitive eligible" />
        <StatCard label="Sanctions flagged" value={String(sanctionsFlagged)} />
        <StatCard label="Re-screen due" value={String(rescreenDue)} sub={`>${SANCTIONS_RESCREEN_DAYS}d since last check`} />
        <StatCard label="Tax incomplete" value={String(taxIncomplete)} sub="payout-blocked" />
        <StatCard label={`1099 watchlist (≥${formatMoney(TAX_1099_THRESHOLD_USD)})`} value={String(watchlist.length)} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {(["id_biometric", "email_phone", "none"] as KycLevel[]).map((k) => (
          <Card key={k}>
            <div className="text-xs uppercase tracking-wide text-p-secondary">{KYC_LABEL[k]}</div>
            <div className="mt-1 text-2xl font-semibold text-p-primary">{kycCounts[k] ?? 0}</div>
          </Card>
        ))}
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">1099-NEC watchlist</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Annotator</TH><TH>YTD paid</TH><TH>Tax form</TH></THead>
          <TBody>
            {watchlist.length === 0 && <EmptyRow colSpan={3}>No annotators over the {formatMoney(TAX_1099_THRESHOLD_USD)} threshold.</EmptyRow>}
            {watchlist.sort((a, b) => b.ytd - a.ytd).map((w) => (
              <TR key={w.id}>
                <TD><Link href={`/admin/talent/${w.id}`} className="text-p-primary hover:text-p-accent">{w.name}</Link></TD>
                <TD className="tabular-nums text-p-primary">{formatMoney(w.ytd)}</TD>
                <TD>{w.taxOk ? <Badge intent="success">On file</Badge> : <Badge intent="danger">Missing</Badge>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Regional labor-classification checklist</h2>
      <p className="mt-1 text-xs text-p-secondary">
        Contractor-vs-employee exposure per active recruiting country. A product-side prompt for legal review — not legal advice;
        keep determinations current as rules evolve. Re-screened on a {SANCTIONS_RESCREEN_DAYS}-day cadence alongside sanctions.
      </p>
      <div className="mt-3">
        <Table>
          <THead><TH>Country</TH><TH>Active workers</TH><TH>Classification risk</TH><TH>Review note</TH></THead>
          <TBody>
            {laborRows.length === 0 && <EmptyRow colSpan={4}>No active workers yet.</EmptyRow>}
            {laborRows.map((r) => (
              <TR key={r.country}>
                <TD className="text-p-primary">{r.country}</TD>
                <TD className="tabular-nums text-p-secondary">{r.count}</TD>
                <TD><Badge intent={LABOR_RISK_INTENT[r.risk]} icon={false}>{r.risk === "high" ? "High · escalate to legal" : r.risk === "medium" ? "Review" : "Low"}</Badge></TD>
                <TD className="text-xs text-p-secondary">{r.note}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-p-secondary">Tax incomplete (payout-blocked)</h2>
          <Table>
            <THead><TH>Annotator</TH><TH>Country</TH></THead>
            <TBody>
              {taxIncompleteList.length === 0 && <EmptyRow colSpan={2}>All annotators have tax on file.</EmptyRow>}
              {taxIncompleteList.map((t) => (
                <TR key={t.id}><TD><Link href={`/admin/talent/${t.id}`} className="text-p-primary hover:text-p-accent">{t.name}</Link></TD><TD className="text-p-secondary">{t.country}</TD></TR>
              ))}
            </TBody>
          </Table>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-p-secondary">Dormant applicants (warned at {DORMANCY_WARN_MONTHS}mo)</h2>
          <Table>
            <THead><TH>Email</TH><TH>Idle since</TH><TH>Warned</TH></THead>
            <TBody>
              {dormant.length === 0 && <EmptyRow colSpan={3}>No dormant applicants.</EmptyRow>}
              {dormant.map((d) => (
                <TR key={d.id}>
                  <TD className="text-p-secondary">{d.email}</TD>
                  <TD className="text-xs text-p-secondary">{d.lastActiveAt?.toLocaleDateString() ?? "—"}</TD>
                  <TD>{d.dormantNotifiedAt ? <Badge intent="warning">Sent</Badge> : <Badge intent="neutral">—</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
