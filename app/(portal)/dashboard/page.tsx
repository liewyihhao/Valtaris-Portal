import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { StatCard, Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Alert } from "@/components/portal/ui/Alert";
import { getEarningsSummary } from "@/lib/portal/earnings";
import { formatMoney } from "@/lib/portal/labels";
import { TIER_LABEL, DOMAIN_LABEL, type Tier } from "@/lib/portal/constants";

export default async function DashboardPage() {
  const user = await requireUser();
  // Not yet approved → keep them in the funnel.
  if (user.role === "applicant") redirect("/apply");

  const quals = await prisma.qualification.findMany({
    where: { userId: user.id, status: "active" },
    include: { track: true },
  });
  const trackIds = quals.map((q) => q.trackId);

  const batches = await prisma.taskBatch.findMany({
    where: { trackId: { in: trackIds }, isActive: true },
    include: { track: true },
  });

  const mapping = await prisma.labelStudioMapping.findMany({
    where: { trackId: { in: trackIds } },
  });
  const inviteByProject = new Map(mapping.map((m) => [m.labelStudioProjectId, m.inviteLink]));

  const { paidThisWeek, available, pending } = await getEarningsSummary(user.id);

  const openFlags = await prisma.reviewFlag.count({ where: { userId: user.id, status: "open" } });
  const openAppeals = await prisma.appeal.count({ where: { userId: user.id, status: { in: ["open", "under_review"] } } });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Task hub</h1>
      <p className="mt-1 text-sm text-p-secondary">Your qualified tracks and the batches you can pick up.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Earned this week" value={formatMoney(paidThisWeek)} sub="paid out" />
        <StatCard label="Available balance" value={formatMoney(available)} sub="approved, awaiting payout" />
        <StatCard label="Pending QA" value={formatMoney(pending)} sub="in the quality window" />
      </div>

      {(openAppeals > 0 || openFlags > 0) && (
        <div className="mt-4">
          <Alert tone="warning" title="Open items">
            {openAppeals > 0 && <span>{openAppeals} open appeal{openAppeals > 1 ? "s" : ""}. </span>}
            {openFlags > 0 && <span>{openFlags} account flag{openFlags > 1 ? "s" : ""} under review.</span>}
          </Alert>
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Your tiers</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {quals.map((q) => (
          <Card key={q.id} className="flex items-center justify-between">
            <div>
              <div className="font-medium text-p-primary">{q.track.name}</div>
              <div className="text-xs text-p-secondary">{DOMAIN_LABEL[q.track.domain as keyof typeof DOMAIN_LABEL]}</div>
            </div>
            <Badge intent="info" icon={false}>{TIER_LABEL[q.tier as Tier]}</Badge>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Available task batches</h2>
      <div className="mt-3">
        <Table>
          <THead>
            <TH>Batch</TH><TH>Track</TH><TH>Est. size</TH><TH>Complexity</TH><TH></TH>
          </THead>
          <TBody>
            {batches.length === 0 && <EmptyRow colSpan={5}>No open batches for your tracks right now. Check back soon.</EmptyRow>}
            {batches.map((b) => {
              const invite = b.labelStudioProjectId ? inviteByProject.get(b.labelStudioProjectId) : null;
              return (
                <TR key={b.id}>
                  <TD>
                    <div className="font-medium text-p-primary">{b.taskType}</div>
                    <div className="text-xs text-p-secondary">{b.clientName}</div>
                  </TD>
                  <TD className="text-p-secondary">{b.track.name}</TD>
                  <TD className="text-p-secondary">{b.estimatedItems} items</TD>
                  <TD className="text-p-secondary">×{b.complexityMultiplier}</TD>
                  <TD className="text-right">
                    {invite ? (
                      <a href={invite} target="_blank" rel="noreferrer noopener" className="text-sm font-medium text-p-accent hover:underline">
                        Open in Label Studio →
                      </a>
                    ) : (
                      <span className="text-xs text-p-disabled">Provisioning…</span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
