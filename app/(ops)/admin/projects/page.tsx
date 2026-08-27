import Link from "next/link";
import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { Card, StatCard } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { ProjectForm } from "@/components/portal/ProjectForm";

export default async function ProjectsPage() {
  await requireCapability("recruiter");
  const [tracks, projects] = await Promise.all([
    prisma.track.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.taskBatch.findMany({
      include: {
        track: true,
        cohorts: { include: { _count: { select: { members: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeCount = projects.filter((p) => p.isActive).length;
  const staffed = projects.reduce((n, p) => n + p.cohorts.reduce((m, c) => m + c._count.members, 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Projects</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Set up client projects and staff them with qualified annotators from the talent pool.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Projects" value={String(projects.length)} sub={`${activeCount} active`} />
        <StatCard label="Assigned annotators" value={String(staffed)} />
        <StatCard label="Tracks in use" value={String(new Set(projects.map((p) => p.trackId)).size)} />
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-p-primary">Create a project</h2>
        <ProjectForm tracks={tracks} />
      </Card>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">All projects</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Project</TH><TH>Client</TH><TH>Track</TH><TH>Est. items</TH><TH>Staffed</TH><TH>Status</TH></THead>
          <TBody>
            {projects.length === 0 && <EmptyRow colSpan={6}>No projects yet — create one above.</EmptyRow>}
            {projects.map((p) => {
              const members = p.cohorts.reduce((m, c) => m + c._count.members, 0);
              return (
                <TR key={p.id}>
                  <TD><Link href={`/admin/projects/${p.id}`} className="text-p-primary hover:text-p-accent">{p.taskType}</Link></TD>
                  <TD className="text-p-secondary">{p.clientName}</TD>
                  <TD className="text-p-secondary">{p.track.name}</TD>
                  <TD className="tabular-nums text-p-secondary">{p.estimatedItems.toLocaleString()}</TD>
                  <TD className="tabular-nums text-p-secondary">{members}</TD>
                  <TD><Badge intent={p.isActive ? "success" : "neutral"} icon={false}>{p.isActive ? "Active" : "Inactive"}</Badge></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
