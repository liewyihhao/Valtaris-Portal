import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { getFunnel } from "@/lib/portal/analytics";
import { Card, StatCard } from "@/components/portal/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";

export default async function FunnelPage() {
  await requireCapability("recruiter");
  const funnel = await getFunnel();
  const intakeCohorts = await prisma.cohort.findMany({
    where: { kind: "intake" },
    include: { _count: { select: { intakeUsers: true } } },
    orderBy: { intakeStartDate: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Recruiting funnel</h1>
      <p className="mt-1 text-sm text-p-secondary">Applied → screened → exam → approved → active, with conversion at each step.</p>

      <div className="mt-6 space-y-2">
        {funnel.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className="w-32 text-sm text-p-secondary">{s.label}</div>
            <div className="h-8 flex-1 overflow-hidden rounded-lg bg-p-surface-2">
              <div className="flex h-full items-center bg-p-accent-subtle px-3 text-xs font-medium text-p-accent" style={{ width: `${Math.max(s.pct, 6)}%` }}>
                {s.n}
              </div>
            </div>
            <div className="w-14 text-right text-sm text-p-secondary">{s.pct}%</div>
            {i > 0 && <div className="w-16 text-right text-xs text-p-disabled">step {Math.round((s.n / (funnel[i - 1].n || 1)) * 100)}%</div>}
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Intake cohorts</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Cohort</TH><TH>Source</TH><TH>Region</TH><TH>Intake window</TH><TH>Size</TH></THead>
          <TBody>
            {intakeCohorts.length === 0 && <EmptyRow colSpan={5}>No intake cohorts yet — tag applicants at intake to measure channel performance.</EmptyRow>}
            {intakeCohorts.map((c) => (
              <TR key={c.id}>
                <TD className="text-p-primary">{c.name}</TD>
                <TD className="text-p-secondary">{c.source ?? "—"}</TD>
                <TD className="text-p-secondary">{c.region ?? "—"}</TD>
                <TD className="text-xs text-p-secondary">{c.intakeStartDate?.toLocaleDateString() ?? "—"}{c.intakeEndDate ? ` – ${c.intakeEndDate.toLocaleDateString()}` : ""}</TD>
                <TD className="text-p-secondary">{c._count.intakeUsers}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
