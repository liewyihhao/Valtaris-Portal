import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { studioEligible } from "@/lib/portal/studio-access";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { InvitationActions } from "@/components/portal/InvitationActions";

export default async function InvitationsPage() {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");

  const [memberships, studio] = await Promise.all([
    prisma.cohortMember.findMany({
      where: { userId: user.id, status: { in: ["invited", "accepted", "declined"] } },
      include: { cohort: { include: { taskBatch: { include: { track: true } } } } },
      orderBy: { addedAt: "desc" },
    }),
    studioEligible(user.id),
  ]);

  const pending = memberships.filter((m) => m.status === "invited");
  const past = memberships.filter((m) => m.status !== "invited");

  function projectLine(m: (typeof memberships)[number]) {
    const b = m.cohort.taskBatch;
    if (!b) return { title: m.cohort.name, sub: "Project pending assignment" };
    return {
      title: b.taskType,
      sub: `${b.clientName} · ${b.track.name} · ${b.estimatedItems.toLocaleString()} est. items`,
    };
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Invitations</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Projects you&apos;ve been selected for. Accept to start working in Studio; decline if you&apos;re unavailable.
      </p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-p-secondary">Pending</h2>
      <div className="mt-3 space-y-3">
        {pending.length === 0 && (
          <Card><p className="text-sm text-p-secondary">No open invitations right now.</p></Card>
        )}
        {pending.map((m) => {
          const p = projectLine(m);
          return (
            <Card key={m.id}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-p-primary">{p.title}</div>
                  <div className="mt-0.5 text-xs text-p-secondary">{p.sub}</div>
                </div>
                <Badge intent="info" icon={false}>Invited</Badge>
              </div>
              <InvitationActions invitationId={m.id} />
            </Card>
          );
        })}
      </div>

      {past.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Responded</h2>
          <div className="mt-3 space-y-3">
            {past.map((m) => {
              const p = projectLine(m);
              const accepted = m.status === "accepted";
              return (
                <Card key={m.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-p-primary">{p.title}</div>
                      <div className="mt-0.5 text-xs text-p-secondary">{p.sub}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge intent={accepted ? "success" : "neutral"} icon={false}>{accepted ? "Accepted" : "Declined"}</Badge>
                      {accepted && studio.eligible && (
                        <a href="/api/studio/sso" className="rounded-lg bg-p-accent px-3 py-1.5 text-xs font-semibold text-[#08111f] hover:bg-p-accent-hover">
                          Open in Studio →
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
