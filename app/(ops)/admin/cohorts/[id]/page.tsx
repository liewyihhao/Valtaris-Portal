import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePM } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD } from "@/components/portal/ui/Table";
import { CohortActions } from "@/components/portal/CohortActions";
import { TIER_LABEL, DOMAIN_LABEL, type Tier } from "@/lib/portal/constants";

export default async function CohortDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePM();
  const { id } = await params;
  const cohort = await prisma.cohort.findUnique({
    where: { id },
    include: {
      taskBatch: { include: { track: true } },
      members: { include: { user: { include: { qualifications: { include: { track: true } }, annotatorLanguages: true } } } },
    },
  });
  if (!cohort) notFound();

  const batches = await prisma.taskBatch.findMany({ where: { isActive: true }, include: { track: true } });

  return (
    <div>
      <Link href="/admin/cohorts" className="text-sm text-p-secondary hover:text-p-primary">← Cohorts</Link>
      <h1 className="mt-2 text-2xl font-semibold text-p-primary">{cohort.name}</h1>
      <p className="mt-1 text-sm text-p-secondary">
        {cohort.clientName ? `${cohort.clientName} · ` : ""}{cohort.members.length} members ·{" "}
        <Badge intent={cohort.status === "assigned" ? "success" : cohort.status === "archived" ? "neutral" : "warning"}>{cohort.status}</Badge>
        {cohort.taskBatch ? ` · assigned to ${cohort.taskBatch.taskType}` : ""}
      </p>

      <Card className="mt-5">
        <CohortActions
          cohortId={cohort.id}
          status={cohort.status}
          batches={batches.map((b) => ({ id: b.id, label: `${b.taskType} — ${b.track.name} (${b.clientName})` }))}
        />
      </Card>

      <div className="mt-5">
        <Table>
          <THead><TH>Annotator</TH><TH>Tiers</TH><TH>Languages</TH><TH>Region</TH><TH>Member status</TH></THead>
          <TBody>
            {cohort.members.map((m) => (
              <TR key={m.id}>
                <TD>
                  <Link href={`/admin/talent/${m.user.id}`} className="font-medium text-p-primary hover:text-p-accent">{m.user.fullName ?? m.user.email}</Link>
                  <div className="text-xs text-p-secondary">{m.user.email}</div>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {m.user.qualifications.map((q) => (
                      <Badge key={q.id} intent="info" icon={false}>
                        {DOMAIN_LABEL[q.track.domain as keyof typeof DOMAIN_LABEL]} · {TIER_LABEL[q.tier as Tier].split(" · ")[0]}
                      </Badge>
                    ))}
                  </div>
                </TD>
                <TD className="text-xs text-p-secondary">{m.user.annotatorLanguages.map((l) => l.language).join(", ")}</TD>
                <TD className="text-p-secondary">{m.user.country}</TD>
                <TD><Badge intent={m.status === "confirmed" ? "success" : "warning"}>{m.status}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
