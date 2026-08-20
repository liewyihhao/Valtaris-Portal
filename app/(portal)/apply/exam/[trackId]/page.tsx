import { notFound } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { ExamRunner } from "@/components/portal/ExamRunner";
import { Alert } from "@/components/portal/ui/Alert";
import { DOMAIN_LABEL } from "@/lib/portal/constants";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function ExamPage({ params }: { params: Promise<{ trackId: string }> }) {
  await requireUser();
  const { trackId } = await params;
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) notFound();

  // Gold items = auto-gradable calibration questions for this track's domain.
  const items = await prisma.calibrationQuestion.findMany({
    where: { trackId, isActive: true, correctIndex: { not: null } },
    select: { id: true, prompt: true, options: true },
  });
  const examItems = shuffle(items).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: (q.options as string[]) ?? [],
  }));

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">Step 3 · Qualification test</div>
      <h1 className="mt-1 text-2xl font-semibold text-p-primary">
        {DOMAIN_LABEL[track.domain as keyof typeof DOMAIN_LABEL] ?? track.name} qualification
      </h1>
      <p className="mt-1 text-sm text-p-secondary">
        Golden-task exam. Your score sets your tier and pay band — nothing you claimed about yourself does.
      </p>

      <div className="mt-4">
        <Alert tone="info" title="In production this is a Label Studio project">
          This exam mirrors the real annotation interface. In the full deployment it deep-links into a
          Label Studio &quot;qualification&quot; project pre-loaded with gold tasks, and the score posts back via webhook.
          Here it runs in-app so the flow is exercisable end-to-end.
        </Alert>
      </div>

      {examItems.length === 0 ? (
        <div className="mt-6"><Alert tone="warning">No gold items are configured for this track yet.</Alert></div>
      ) : (
        <div className="mt-6">
          <ExamRunner trackId={trackId} items={examItems} />
        </div>
      )}
    </div>
  );
}
