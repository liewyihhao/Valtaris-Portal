import { notFound } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { LinkButton } from "@/components/portal/ui/Button";
import { Alert } from "@/components/portal/ui/Alert";
import { Badge } from "@/components/portal/ui/Badge";
import { TIER_LABEL, type Tier } from "@/lib/portal/constants";

export default async function ExamResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ trackId: string }>;
  searchParams: Promise<{ score?: string; passed?: string; tier?: string }>;
}) {
  const user = await requireUser();
  const { trackId } = await params;
  const sp = await searchParams;

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) notFound();

  const passed = sp.passed === "true";
  const score = sp.score ? Math.round(Number(sp.score)) : null;
  const tier = (sp.tier as Tier | undefined) ?? "T0_trainee";

  const lastAttempt = await prisma.qualificationTestAttempt.findFirst({
    where: { userId: user.id, trackId },
    orderBy: { startedAt: "desc" },
  });

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">Qualification result</div>
      <h1 className="mt-1 text-2xl font-semibold text-p-primary">{track.name}</h1>

      <Card className="mt-6">
        <div className="flex items-center gap-3">
          {passed ? (
            <Badge intent="success">Passed</Badge>
          ) : (
            <Badge intent="danger">Not passed</Badge>
          )}
          {score !== null && <span className="text-sm text-p-secondary">Score: <b className="text-p-primary">{score}%</b></span>}
        </div>

        {passed ? (
          <>
            <p className="mt-4 text-sm text-p-primary">
              You qualified at <b className="text-p-accent">{TIER_LABEL[tier]}</b> for this track. Next, review the
              task guidelines before starting paid work.
            </p>
            <div className="mt-5">
              <LinkButton href={`/apply/guidelines/${trackId}`}>Continue to guidelines →</LinkButton>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4">
              <Alert tone="warning" title="You can retake after a short cooldown">
                {lastAttempt?.cooldownUntil
                  ? `You can try again after ${new Date(lastAttempt.cooldownUntil).toLocaleString()}.`
                  : "You can try again after the cooldown window."}
                {" "}Consider the guidelines and training material before retrying.
              </Alert>
            </div>
            <div className="mt-5">
              <LinkButton href="/apply" variant="secondary">Back to dashboard</LinkButton>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
