import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { StatCard, Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { TicketActions } from "@/components/portal/TicketActions";

const CAT_LABEL: Record<string, string> = {
  payout_issue: "Payout issue", exam_dispute: "Exam dispute", account_access: "Account access",
  technical_bug: "Technical bug", policy_question: "Policy question", other: "Other",
};

export default async function SupportQueuePage() {
  await requireCapability("support");
  const tickets = await prisma.supportTicket.findMany({
    where: { status: { in: ["open", "in_progress"] } },
    include: { user: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  const byCat = tickets.reduce<Record<string, number>>((a, t) => ({ ...a, [t.category]: (a[t.category] ?? 0) + 1 }), {});

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Support queue</h1>
      <p className="mt-1 text-sm text-p-secondary">Open tickets by category and priority. Payout & exam disputes point back to the appeal flow, not a parallel process.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Open tickets" value={String(tickets.length)} />
        <StatCard label="Payout issues" value={String(byCat.payout_issue ?? 0)} />
        <StatCard label="Account access" value={String(byCat.account_access ?? 0)} />
        <StatCard label="Technical bugs" value={String(byCat.technical_bug ?? 0)} />
      </div>

      <div className="mt-6 space-y-3">
        {tickets.length === 0 && <Alert tone="success" title="Queue clear">No open tickets.</Alert>}
        {tickets.map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-p-primary">{t.subject}</span>
                  <Badge intent={t.priority === "high" ? "danger" : "neutral"} icon={false}>{t.priority}</Badge>
                  <Badge intent="info" icon={false}>{CAT_LABEL[t.category] ?? t.category}</Badge>
                </div>
                <div className="mt-1 text-xs text-p-secondary">{t.user.email} · {t.createdAt.toLocaleDateString()}</div>
                <p className="mt-2 max-w-2xl text-sm text-p-secondary">{t.body}</p>
              </div>
            </div>
            <TicketActions id={t.id} />
          </Card>
        ))}
      </div>
    </div>
  );
}
