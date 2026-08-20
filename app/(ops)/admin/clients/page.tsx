import { requireOps } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/portal/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { getMarginByClient } from "@/lib/portal/margin";
import { formatMoney } from "@/lib/portal/labels";

export default async function ClientsPage() {
  await requireOps();
  const { rows, totals } = await getMarginByClient();

  const clients = await prisma.client.findMany({
    include: { rateCards: { where: { isCurrent: true } } },
    orderBy: { name: "asc" },
  });
  const annotatorRates = await prisma.rateCard.findMany({ where: { isCurrent: true } });
  const payRate = new Map(annotatorRates.map((r) => [r.taskType, r.baseRate]));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Clients &amp; margin</h1>
      <p className="mt-1 text-sm text-p-secondary">
        What Valtaris charges clients vs. what it pays annotators. Margin = revenue − annotator cost.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue (approved+paid)" value={formatMoney(totals.revenue)} />
        <StatCard label="Annotator cost" value={formatMoney(totals.cost)} />
        <StatCard label="Gross margin" value={formatMoney(totals.margin)} sub={totals.revenue ? `${Math.round((totals.margin / totals.revenue) * 100)}%` : "—"} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Margin by client</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Client</TH><TH>Items</TH><TH>Revenue</TH><TH>Cost</TH><TH>Margin</TH><TH>%</TH></THead>
          <TBody>
            {rows.length === 0 && <EmptyRow colSpan={6}>No billable work yet.</EmptyRow>}
            {rows.map((r) => (
              <TR key={r.key}>
                <TD className="text-p-primary">{r.name}</TD>
                <TD className="text-p-secondary">{r.items}</TD>
                <TD className="tabular-nums text-p-primary">{formatMoney(r.revenue)}</TD>
                <TD className="tabular-nums text-p-secondary">{formatMoney(r.cost)}</TD>
                <TD className="tabular-nums text-p-primary">{formatMoney(r.margin)}</TD>
                <TD><Badge intent={r.marginPct >= 40 ? "success" : r.marginPct >= 20 ? "warning" : "danger"}>{r.marginPct}%</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <div className="mt-4">
        <Alert tone="info" title="Floor-rate protection">
          Annotator pay is set by the versioned rate card + tier, never derived after the fact from margin. Client
          charge rates are managed separately below.
        </Alert>
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Client charge rates</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Client</TH><TH>Task type</TH><TH>Charge / item</TH><TH>Annotator pay / item</TH><TH>Spread</TH></THead>
          <TBody>
            {clients.flatMap((c) => c.rateCards).length === 0 && <EmptyRow colSpan={5}>No client rate cards configured.</EmptyRow>}
            {clients.flatMap((c) =>
              c.rateCards.map((rc) => {
                const pay = payRate.get(rc.taskType) ?? 0;
                return (
                  <TR key={rc.id}>
                    <TD className="text-p-primary">{c.name}</TD>
                    <TD className="text-p-secondary">{rc.taskType}</TD>
                    <TD className="tabular-nums text-p-primary">{formatMoney(rc.chargeRate)}</TD>
                    <TD className="tabular-nums text-p-secondary">{formatMoney(pay)}</TD>
                    <TD className="tabular-nums text-p-secondary">{formatMoney(rc.chargeRate - pay)}</TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
