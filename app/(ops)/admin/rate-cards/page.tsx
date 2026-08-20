import { prisma } from "@/lib/db";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { formatMoney } from "@/lib/portal/labels";
import { TIER_MULTIPLIER } from "@/lib/portal/constants";

export default async function RateCardsPage() {
  const cards = await prisma.rateCard.findMany({
    include: { track: true },
    orderBy: [{ trackId: "asc" }, { taskType: "asc" }, { version: "desc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Rate cards</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Versioned base rates + floors per task type. Past versions are never mutated — historical payouts stay auditable.
      </p>

      <div className="mt-4">
        <Alert tone="info" title="Tier multipliers (payout = base × complexity × tier)">
          T1 = {TIER_MULTIPLIER.T1_associate}× · T2 = {TIER_MULTIPLIER.T2_skilled}× · T3 = {TIER_MULTIPLIER.T3_specialist}×
        </Alert>
      </div>

      <div className="mt-6">
        <Table>
          <THead><TH>Track</TH><TH>Task type</TH><TH>Base rate</TH><TH>Floor</TH><TH>Version</TH><TH>Effective</TH></THead>
          <TBody>
            {cards.length === 0 && <EmptyRow colSpan={6}>No rate cards yet.</EmptyRow>}
            {cards.map((c) => (
              <TR key={c.id}>
                <TD className="text-p-primary">{c.track.name}</TD>
                <TD className="text-p-secondary">{c.taskType}</TD>
                <TD className="tabular-nums text-p-primary">{formatMoney(c.baseRate)}/item</TD>
                <TD className="tabular-nums text-p-secondary">{formatMoney(c.floorRate)}</TD>
                <TD>{c.isCurrent ? <Badge intent="success" icon={false}>v{c.version} · current</Badge> : <Badge intent="neutral" icon={false}>v{c.version}</Badge>}</TD>
                <TD className="text-xs text-p-secondary">{c.effectiveFrom.toLocaleDateString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
