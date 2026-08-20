import { prisma } from "@/lib/db";

// Revenue (what Valtaris charges clients) vs cost (what it pays annotators),
// per client. Revenue uses the current ClientRateCard chargeRate × item count
// on approved/paid payouts; cost is the payout gross. Margin = revenue − cost.
export async function getMarginByClient() {
  const [clients, clientRates, payouts] = await Promise.all([
    prisma.client.findMany(),
    prisma.clientRateCard.findMany({ where: { isCurrent: true } }),
    prisma.payout.findMany({
      where: { status: { in: ["approved", "paid"] } },
      include: { taskBatch: true },
    }),
  ]);

  const clientByKey = new Map(clients.map((c) => [c.key, c]));
  const chargeRate = new Map(clientRates.map((r) => [`${r.clientId}:${r.taskType}`, r.chargeRate]));

  type Row = { key: string; name: string; revenue: number; cost: number; items: number };
  const rows = new Map<string, Row>();

  for (const p of payouts) {
    const key = p.taskBatch.clientId;
    const client = clientByKey.get(key);
    const name = client?.name ?? key;
    const rate = client ? chargeRate.get(`${client.id}:${p.taskBatch.taskType}`) ?? 0 : 0;
    const revenue = rate * p.itemCount;
    const row = rows.get(key) ?? { key, name, revenue: 0, cost: 0, items: 0 };
    row.revenue += revenue;
    row.cost += p.grossAmount;
    row.items += p.itemCount;
    rows.set(key, row);
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const list = [...rows.values()].map((r) => ({
    ...r,
    revenue: round(r.revenue),
    cost: round(r.cost),
    margin: round(r.revenue - r.cost),
    marginPct: r.revenue > 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 100) : 0,
  }));

  const totals = list.reduce(
    (a, r) => ({ revenue: a.revenue + r.revenue, cost: a.cost + r.cost, margin: a.margin + r.margin }),
    { revenue: 0, cost: 0, margin: 0 }
  );
  return {
    rows: list.sort((a, b) => b.margin - a.margin),
    totals: { revenue: round(totals.revenue), cost: round(totals.cost), margin: round(totals.margin) },
  };
}
