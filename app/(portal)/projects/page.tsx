import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { setupUrlFor } from "@/lib/portal/project-credential";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";

export default async function ProjectsPage() {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");

  const creds = await prisma.projectCredential.findMany({
    where: { userId: user.id },
    include: { taskBatch: { include: { track: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Projects</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Projects you&apos;ve accepted. Set up your project login, then enter to select files and work in Studio.
      </p>

      <div className="mt-6 space-y-3">
        {creds.length === 0 && (
          <Card><p className="text-sm text-p-secondary">No projects yet. When you accept a project invitation, it appears here.</p></Card>
        )}
        {creds.map((c) => {
          const b = c.taskBatch;
          const ready = c.status === "active" && c.verifiedAt;
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-p-primary">{b.taskType}</div>
                  <div className="mt-0.5 text-xs text-p-secondary">
                    {b.clientName} · {b.track.name} · project login <span className="font-mono">{c.username}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ready ? (
                    <>
                      <Badge intent="success" icon={false}>Access ready</Badge>
                      <Link href={`/projects/${b.id}`} className="rounded-lg bg-p-accent px-3 py-1.5 text-xs font-semibold text-[#08111f] hover:bg-p-accent-hover">Enter project →</Link>
                    </>
                  ) : (
                    <>
                      <Badge intent="warning" icon={false}>Setup needed</Badge>
                      <Link href={setupUrlFor(c.id)} className="rounded-lg border border-p-border px-3 py-1.5 text-xs text-p-accent hover:underline">Set up login</Link>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
