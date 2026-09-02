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
import { DatasetUploader } from "@/components/portal/DatasetUploader";
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
      datasetUploads: { orderBy: { createdAt: "desc" } },
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
          />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <Card><div className="text-xs uppercase tracking-wide text-p-secondary">Estimated items</div><div className="mt-1 text-2xl font-semibold text-p-primary">{project.estimatedItems.toLocaleString()}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-p-secondary">Complexity ×</div><div className="mt-1 text-2xl font-semibold text-p-primary">{project.complexityMultiplier}</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-p-secondary">Invited</div><div className="mt-1 text-2xl font-semibold text-p-primary">{allMembers.length}</div><div className="text-xs text-p-secondary">{accepted} accepted · {invited} pending</div></Card>
        <Card><div className="text-xs uppercase tracking-wide text-p-secondary">Studio project</div><div className="mt-1 text-sm text-p-primary">{project.labelStudioProjectId ?? "—"}</div></Card>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Dataset — {project.importedItems.toLocaleString()} items imported</h2>
      <p className="mt-1 text-xs text-p-secondary">
        Upload the customer file; items stream into the Studio project as tasks for annotators to label.
        {!project.labelStudioProjectId && " Provision the Studio project first (above) or the import will fail."}
      </p>
      <Card className="mt-3">
        <DatasetUploader
          projectId={project.id}
          uploads={project.datasetUploads.map((u) => ({ id: u.id, filename: u.filename, format: u.format, status: u.status, importedRows: u.importedRows, lastError: u.lastError }))}
        />
      </Card>

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
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-p-secondary">By annotator</div>
                <Table>
                  <THead><TH>Annotator</TH><TH>Tasks</TH><TH>Units</TH><TH>Payable</TH></THead>
                  <TBody>
                    {deliverable.byWorker.length === 0 && <EmptyRow colSpan={4}>No accepted annotations yet.</EmptyRow>}
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
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-p-secondary">By validator</div>
                <Table>
                  <THead><TH>Validator</TH><TH>Reviewed</TH><TH>Approved</TH><TH>Rej/Corr</TH></THead>
                  <TBody>
                    {deliverable.byValidator.length === 0 && <EmptyRow colSpan={4}>No validations yet.</EmptyRow>}
                    {deliverable.byValidator.map((v) => (
                      <TR key={v.userId}>
                        <TD className="text-p-primary">{v.name}</TD>
                        <TD className="tabular-nums text-p-secondary">{v.reviewed}</TD>
                        <TD className="tabular-nums text-success">{v.approved}</TD>
                        <TD className="tabular-nums text-p-secondary">{v.rejected} / {v.corrections}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </div>
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
