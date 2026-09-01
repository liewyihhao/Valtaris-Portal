import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Button } from "@/components/portal/ui/Button";
import { ProjectActions } from "@/components/portal/ProjectActions";
import { DeliverableActions } from "@/components/portal/DeliverableActions";
import { getProjectDeliverable } from "@/lib/portal/deliverable";
import { formatMoney } from "@/lib/portal/labels";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("recruiter");
  const { id } = await params;
  const project = await prisma.taskBatch.findUnique({
    where: { id },
    include: {
      track: true,
      cohorts: {
        include: { members: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();

  const deliverable = await getProjectDeliverable(id);
  const deliveryIntent = project.deliveryStatus === "delivered" ? "success" : project.deliveryStatus === "in_review" ? "warning" : "neutral";

  const allMembers = project.cohorts.flatMap((c) => c.members);
  const accepted = allMembers.filter((m) => m.status === "accepted").length;
  const invited = allMembers.filter((m) => m.status === "invited").length;

  const memberIntent = (s: string) =>
    s === "accepted" ? "success" : s === "declined" ? "danger" : s === "invited" ? "info" : "neutral";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/projects" className="text-xs text-p-accent hover:underline">← Projects</Link>
          <h1 className="mt-1 text-2xl font-semibold text-p-primary">{project.taskType}</h1>
          <p className="mt-1 text-sm text-p-secondary">
            {project.clientName} · {project.track.name} ·{" "}
            <Badge intent={project.isActive ? "success" : "neutral"} icon={false}>{project.isActive ? "Active" : "Inactive"}</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/talent?track=${project.trackId}`}><Button size="sm">Staff from talent pool</Button></Link>
          <ProjectActions
            projectId={project.id}
            isActive={project.isActive}
            studioProjectId={project.labelStudioProjectId}
            studioBaseUrl={process.env.LABEL_STUDIO_BASE_URL ?? "http://localhost:8091"}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <Card><div className="text-xs uppercase tracking-wide text-p-secondary">Estimated items</div><div className="mt-1 text-2xl font-semibold text-p-primary">{project.estimatedItems.toLocaleString()}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-p-secondary">Complexity ×</div><div className="mt-1 text-2xl font-semibold text-p-primary">{project.complexityMultiplier}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-p-secondary">Invited</div><div className="mt-1 text-2xl font-semibold text-p-primary">{allMembers.length}</div><div className="text-xs text-p-secondary">{accepted} accepted · {invited} pending</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-p-secondary">Studio project</div><div className="mt-1 text-sm text-p-primary">{project.labelStudioProjectId ?? "—"}</div></Card>
      </div>

      <div className="mt-8 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-p-secondary">Deliverable — final review</h2>
        <Badge intent={deliveryIntent} icon={false}>{project.deliveryStatus.replace("_", " ")}</Badge>
      </div>
      <p className="mt-1 text-xs text-p-secondary">
        Accepted (validated + payable) output for this project, drawn from the payout ledger. Review, then file the client submission.
      </p>
      <Card className="mt-3">
        {deliverable && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <div><div className="text-xs uppercase tracking-wide text-p-secondary">Accepted units</div><div className="mt-1 text-2xl font-semibold text-p-primary">{deliverable.totals.acceptedUnits.toLocaleString()}</div><div className="text-xs text-p-secondary">{deliverable.totals.acceptedTasks} tasks</div></div>
              <div><div className="text-xs uppercase tracking-wide text-p-secondary">Completion</div><div className="mt-1 text-2xl font-semibold text-p-primary">{deliverable.totals.completionPct}%</div><div className="text-xs text-p-secondary">of {project.estimatedItems.toLocaleString()} est.</div></div>
              <div><div className="text-xs uppercase tracking-wide text-p-secondary">Validated reviews</div><div className="mt-1 text-2xl font-semibold text-p-primary">{deliverable.totals.validatedReviews}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-p-secondary">Rejected / pending</div><div className="mt-1 text-2xl font-semibold text-p-primary">{deliverable.totals.rejectedTasks} / {deliverable.totals.pendingTasks}</div></div>
            </div>
            {deliverable.byWorker.length > 0 && (
              <div className="mt-4">
                <Table>
                  <THead><TH>Contributor</TH><TH>Tasks</TH><TH>Units</TH><TH>Payable</TH></THead>
                  <TBody>
                    {deliverable.byWorker.map((w) => (
                      <TR key={w.userId}>
                        <TD className="text-p-primary">{w.name}</TD>
                        <TD className="tabular-nums text-p-secondary">{w.tasks}</TD>
                        <TD className="tabular-nums text-p-secondary">{w.units.toLocaleString()}</TD>
                        <TD className="tabular-nums text-p-secondary">{formatMoney(w.gross)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </>
        )}
        <div className="mt-4">
          <DeliverableActions projectId={project.id} deliveryStatus={project.deliveryStatus} />
        </div>
      </Card>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Staffing</h2>
      <p className="mt-1 text-xs text-p-secondary">
        Select qualified annotators in the <Link href={`/admin/talent?track=${project.trackId}`} className="text-p-accent hover:underline">talent pool</Link>, build a cohort, then assign that cohort to this project from the cohort page.
      </p>
      <div className="mt-3 space-y-4">
        {project.cohorts.length === 0 && (
          <Card><p className="text-sm text-p-secondary">No cohorts assigned yet. Staff this project from the talent pool.</p></Card>
        )}
        {project.cohorts.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between gap-2">
              <Link href={`/admin/cohorts/${c.id}`} className="font-medium text-p-primary hover:text-p-accent">{c.name}</Link>
              <Badge intent="neutral" icon={false}>{c.members.length} member(s)</Badge>
            </div>
            <div className="mt-3">
              <Table>
                <THead><TH>Annotator</TH><TH>Status</TH></THead>
                <TBody>
                  {c.members.length === 0 && <EmptyRow colSpan={2}>No members.</EmptyRow>}
                  {c.members.map((m) => (
                    <TR key={m.id}>
                      <TD><Link href={`/admin/talent/${m.user.id}`} className="text-p-primary hover:text-p-accent">{m.user.fullName ?? m.user.email}</Link></TD>
                      <TD><Badge intent={memberIntent(m.status)} icon={false}>{m.status}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
