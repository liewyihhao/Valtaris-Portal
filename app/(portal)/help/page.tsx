import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { SupportTicketForm } from "@/components/portal/SupportTicketForm";

const FAQ = [
  ["When do I get paid?", "Payouts run weekly for approved balances at or above the $20 minimum. You can request early once you're above the threshold. Every line item shows its status and, if reduced, a specific reason code."],
  ["Why is my work still pending?", "Submissions go through a quality check with a published maximum hold (72h for automated checks). Sampled or probation work may route to a human validator — that has its own published window before it auto-escalates."],
  ["My exam was locked / I failed — what now?", "Failed exams have a short cooldown, shown on the result screen. If you believe a specific payout was wrongly rejected, open an appeal from Earnings — it's adjudicated against the reason code within 3 business days."],
  ["How do I change my payout method?", "Payment details → choose your rail. A change triggers a short re-verification step (an anti-fraud control) before it takes effect."],
  ["How do I become a Validator?", "Reach T2 in a track, then apply from your Profile — you'll sit a Validator Calibration Exam (85% to pass). Review work is paid on the same balance."],
];

export default async function HelpPage() {
  const user = await requireUser();
  const tickets = await prisma.supportTicket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Help Center</h1>
      <p className="mt-1 text-sm text-p-secondary">Most answers are here. If you still need us, open a ticket — it routes by category.</p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Common questions</h2>
      <div className="mt-3 space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-lg border border-p-border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-p-primary">{q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-p-secondary">{a}</p>
          </details>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-p-secondary">Open a ticket</h2>
          <Card><SupportTicketForm /></Card>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-p-secondary">Your tickets</h2>
          <div className="space-y-2">
            {tickets.length === 0 && <p className="text-sm text-p-secondary">No tickets yet.</p>}
            {tickets.map((t) => (
              <Card key={t.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-p-primary">{t.subject}</span>
                  <Badge intent={t.status === "resolved" || t.status === "closed" ? "success" : "warning"}>{t.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-p-secondary">{t.category} · {t.createdAt.toLocaleDateString()}</div>
                {t.resolutionNote && <div className="mt-2 text-sm text-p-secondary">{t.resolutionNote}</div>}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
