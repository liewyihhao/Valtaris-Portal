import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { LinkButton } from "@/components/portal/ui/Button";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { TIER_LABEL, DOMAIN_LABEL, type Tier } from "@/lib/portal/constants";

export default async function ApprovedPage() {
  const user = await requireUser();
  const quals = await prisma.qualification.findMany({
    where: { userId: user.id, status: "active" },
    include: { track: true },
  });

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">Step 6 · Approved</div>
      <h1 className="mt-1 text-2xl font-semibold text-p-primary">You&apos;re in 🎉</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Welcome to Valtaris. Here&apos;s what you&apos;re approved for and what to expect next.
      </p>

      <Card className="mt-6">
        <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">Approved tracks</div>
        <div className="mt-3 space-y-2">
          {quals.length === 0 && <p className="text-sm text-p-secondary">No active qualifications yet.</p>}
          {quals.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-lg border border-p-border px-3 py-2">
              <span className="text-sm text-p-primary">
                {q.track.name}
                <span className="ml-2 text-p-secondary">
                  {DOMAIN_LABEL[q.track.domain as keyof typeof DOMAIN_LABEL]}
                </span>
              </span>
              <Badge intent="success" icon={false}>{TIER_LABEL[q.tier as Tier]}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4">
        <Alert tone="info" title="A short probation window">
          Your first 1–2 weeks are audited more closely, then spot-checking relaxes as you show consistent
          accuracy. This protects everyone&apos;s pay and data quality — it isn&apos;t a penalty.
        </Alert>
      </div>

      <div className="mt-6">
        <LinkButton href="/dashboard">Go to your task hub →</LinkButton>
      </div>
    </div>
  );
}
