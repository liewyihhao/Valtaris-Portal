import Link from "next/link";
import { requirePM } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Badge } from "@/components/portal/ui/Badge";
import type { BadgeIntent } from "@/lib/portal/labels";

const STATUS: Record<string, { label: string; intent: BadgeIntent }> = {
  draft: { label: "Draft", intent: "warning" },
  assigned: { label: "Assigned", intent: "success" },
  archived: { label: "Archived", intent: "neutral" },
};

export default async function CohortsPage() {
  await requirePM();
  const cohorts = await prisma.cohort.findMany({
    include: { _count: { select: { members: true } }, taskBatch: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Cohorts</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Saved talent selections for client projects. Build new ones from the{" "}
        <Link href="/admin/talent" className="text-p-accent hover:underline">Talent pool</Link>.
      </p>

      <div className="mt-6">
        <Table>
          <THead><TH>Cohort</TH><TH>Client</TH><TH>Members</TH><TH>Project</TH><TH>Status</TH><TH></TH></THead>
          <TBody>
            {cohorts.length === 0 && <EmptyRow colSpan={6}>No cohorts yet — select annotators in the Talent pool to create one.</EmptyRow>}
            {cohorts.map((c) => {
              const s = STATUS[c.status] ?? STATUS.draft;
              return (
                <TR key={c.id}>
                  <TD>
                    <div className="font-medium text-p-primary">{c.name}</div>
                    {c.description && <div className="text-xs text-p-secondary">{c.description}</div>}
                  </TD>
                  <TD className="text-p-secondary">{c.clientName ?? "—"}</TD>
                  <TD className="text-p-secondary">{c._count.members}</TD>
                  <TD className="text-p-secondary">{c.taskBatch ? c.taskBatch.taskType : "—"}</TD>
                  <TD><Badge intent={s.intent}>{s.label}</Badge></TD>
                  <TD className="text-right"><Link href={`/admin/cohorts/${c.id}`} className="text-sm text-p-accent hover:underline">Open →</Link></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
