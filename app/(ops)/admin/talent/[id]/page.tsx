import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePM } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card, StatCard } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { TalentActions } from "@/components/portal/TalentActions";
import { TIER_LABEL, DOMAIN_LABEL, KYC_LABEL, type Tier, type KycLevel } from "@/lib/portal/constants";
import { PAYOUT_STATUS_META, formatMoney } from "@/lib/portal/labels";
import type { PayoutStatus } from "@/lib/portal/constants";

export default async function TalentProfile({ params }: { params: Promise<{ id: string }> }) {
  await requirePM();
  const { id } = await params;
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      qualifications: { include: { track: true } },
      annotatorLanguages: true,
      availability: true,
      trustProfile: true,
      taxProfile: true,
      performanceMetrics: { include: { track: true } },
      payouts: { include: { taskBatch: true }, orderBy: { createdAt: "desc" } },
      appeals: true,
      reviewFlags: { where: { status: "open" } },
      cohortMemberships: { include: { cohort: true } },
    },
  });
  if (!u || (u.role !== "annotator" && u.role !== "applicant")) notFound();

  const paidTotal = u.payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.grossAmount, 0);
  const bestAcc = u.performanceMetrics.reduce<number | null>((m, pm) => (pm.rollingAccuracy != null && (m == null || pm.rollingAccuracy > m) ? pm.rollingAccuracy : m), null);

  return (
    <div>
      <Link href="/admin/talent" className="text-sm text-p-secondary hover:text-p-primary">← Talent pool</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-p-primary">{u.fullName ?? u.email}</h1>
          <p className="mt-1 text-sm text-p-secondary">
            {u.email} · {u.country} · {u.primaryLanguage} ·{" "}
            <Badge intent={u.status === "active" ? "success" : u.status === "suspended" ? "danger" : "warning"}>{u.status}</Badge>
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Best accuracy" value={bestAcc != null ? `${Math.round(bestAcc * 100)}%` : "—"} />
        <StatCard label="Paid to date" value={formatMoney(paidTotal)} />
        <StatCard label="KYC level" value={KYC_LABEL[(u.trustProfile?.kycLevel ?? "none") as KycLevel]} />
        <StatCard label="Open flags" value={String(u.reviewFlags.length)} />
      </div>

      <Card className="mt-4">
        <div className="text-xs uppercase tracking-wide text-p-secondary">Actions</div>
        <div className="mt-3"><TalentActions userId={u.id} status={u.status} /></div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="text-xs uppercase tracking-wide text-p-secondary">Trust &amp; verification</div>
          <div className="mt-2 space-y-1 text-sm text-p-primary">
            <div>Email verified: {u.emailVerifiedAt ? "✓" : "—"} · Phone: {u.phoneVerifiedAt ? "✓" : "—"}</div>
            <div>ID: {u.trustProfile?.idVerifiedAt ? "✓" : "—"} · Biometric: {u.trustProfile?.biometricVerifiedAt ? "✓" : "—"}</div>
            <div>Sanctions: <Badge intent={u.trustProfile?.sanctionsStatus === "cleared" ? "success" : u.trustProfile?.sanctionsStatus === "flagged" ? "danger" : "warning"}>{u.trustProfile?.sanctionsStatus ?? "pending"}</Badge></div>
            <div className="text-p-secondary">Risk score: {u.trustProfile?.riskScore ?? "—"}</div>
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-p-secondary">Tax</div>
          <div className="mt-2 space-y-1 text-sm text-p-primary">
            <div>Country: {u.taxProfile?.country ?? u.country}</div>
            <div>Form: {u.taxProfile?.formReference ?? "—"} ({u.taxProfile?.taxIdType ?? "—"})</div>
            <div>Local TIN: {u.taxProfile?.localTinType ?? "—"} ••••{u.taxProfile?.taxIdLast4 ?? "----"}</div>
            <div className="text-p-secondary">{u.taxProfile?.completedAt ? "Complete" : "Incomplete"}</div>
          </div>
        </Card>
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Qualifications &amp; performance</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Track</TH><TH>Tier</TH><TH>Accuracy</TH><TH>Gold pass</TH><TH>IAA</TH><TH>Recert due</TH></THead>
          <TBody>
            {u.qualifications.length === 0 && <EmptyRow colSpan={6}>No qualifications.</EmptyRow>}
            {u.qualifications.map((q) => {
              const pm = u.performanceMetrics.find((p) => p.trackId === q.trackId);
              return (
                <TR key={q.id}>
                  <TD className="text-p-primary">{DOMAIN_LABEL[q.track.domain as keyof typeof DOMAIN_LABEL]}</TD>
                  <TD><Badge intent="info" icon={false}>{TIER_LABEL[q.tier as Tier]}</Badge></TD>
                  <TD className="text-p-secondary">{pm?.rollingAccuracy != null ? `${Math.round(pm.rollingAccuracy * 100)}%` : "—"}</TD>
                  <TD className="text-p-secondary">{pm?.goldPassRate != null ? `${Math.round(pm.goldPassRate * 100)}%` : "—"}</TD>
                  <TD className="text-p-secondary">{pm?.interAnnotatorAgreement != null ? `${Math.round(pm.interAnnotatorAgreement * 100)}%` : "—"}</TD>
                  <TD className="text-xs text-p-secondary">{q.recertDueAt ? q.recertDueAt.toLocaleDateString() : "—"}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Payout history</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Batch</TH><TH>Amount</TH><TH>Status</TH></THead>
          <TBody>
            {u.payouts.length === 0 && <EmptyRow colSpan={3}>No payouts.</EmptyRow>}
            {u.payouts.map((p) => (
              <TR key={p.id}>
                <TD className="text-p-primary">{p.taskBatch.taskType}</TD>
                <TD className="tabular-nums text-p-primary">{formatMoney(p.grossAmount, p.currency)}</TD>
                <TD><Badge intent={PAYOUT_STATUS_META[p.status as PayoutStatus].intent}>{PAYOUT_STATUS_META[p.status as PayoutStatus].label}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {u.cohortMemberships.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Cohorts</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {u.cohortMemberships.map((m) => (
              <Link key={m.id} href={`/admin/cohorts/${m.cohortId}`}><Badge intent="neutral" icon={false}>{m.cohort.name}</Badge></Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
