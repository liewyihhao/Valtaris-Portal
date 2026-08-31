import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { studioEligible } from "@/lib/portal/studio-access";
import { projectAccessCookie } from "@/lib/portal/project-credential";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { ProjectEnterForm } from "@/components/portal/ProjectEnterForm";

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ batchId: string }> }) {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");
  const { batchId } = await params;

  const cred = await prisma.projectCredential.findUnique({
    where: { userId_taskBatchId: { userId: user.id, taskBatchId: batchId } },
    include: { taskBatch: { include: { track: true } } },
  });
  if (!cred || cred.status !== "active" || !cred.verifiedAt) redirect("/projects");
  const b = cred.taskBatch;

  // Per-project gate: this project is unlocked for the session only if the
  // signed cookie set by /api/project-access/enter is present + valid.
  const jar = await cookies();
  const unlocked = jar.get(`pacc_${batchId}`)?.value === projectAccessCookie(user.id, batchId);
  const studio = await studioEligible(user.id);

  return (
    <div>
      <Link href="/projects" className="text-xs text-p-accent hover:underline">← Projects</Link>
      <h1 className="mt-1 text-2xl font-semibold text-p-primary">{b.taskType}</h1>
      <p className="mt-1 text-sm text-p-secondary">{b.clientName} · {b.track.name}</p>

      {!unlocked ? (
        <Card className="mt-6">
          <h2 className="mb-1 font-semibold text-p-primary">Project sign-in</h2>
          <ProjectEnterForm batchId={batchId} username={cred.username} />
        </Card>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge intent="success" icon={false}>Signed in to project</Badge>
            {studio.eligible ? (
              <a href="/api/studio/sso" className="rounded-lg bg-p-accent px-4 py-2 text-sm font-semibold text-[#08111f] hover:bg-p-accent-hover">Open in Studio →</a>
            ) : (
              <span className="rounded-lg border border-p-border px-4 py-2 text-sm text-p-disabled" title={studio.reasons.join(", ")}>Studio locked</span>
            )}
          </div>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Select files to work on</h2>
          <Card className="mt-3">
            <p className="text-sm text-p-secondary">
              Task files for this project are served in Valtaris Studio. Click <b className="text-p-primary">Open in Studio</b> to
              pick up tasks, annotate, and submit — your progress and QA flow back here automatically.
            </p>
            <p className="mt-2 text-xs text-p-disabled">
              Estimated items: {b.estimatedItems.toLocaleString()}{b.labelStudioProjectId ? ` · Studio project #${b.labelStudioProjectId}` : " · Studio project not provisioned yet"}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
