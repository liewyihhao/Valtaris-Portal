import { notFound } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { GuidelineReader } from "@/components/portal/GuidelineReader";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";

export default async function GuidelinesPage({ params }: { params: Promise<{ trackId: string }> }) {
  await requireUser();
  const { trackId } = await params;
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) notFound();

  const current = await prisma.guidelineVersion.findFirst({
    where: { trackId, isCurrent: true },
    orderBy: { version: "desc" },
  });

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">Step 4 · Guidelines</div>
      <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold text-p-primary">
        {track.name} guidelines
        {current && <Badge intent="info" icon={false}>v{current.version}</Badge>}
      </h1>
      <p className="mt-1 text-sm text-p-secondary">
        Read these fully before starting paid work. We record that you&apos;ve seen this exact version.
      </p>

      <div className="mt-6">
        {current ? (
          <GuidelineReader
            trackId={trackId}
            guidelineVersionId={current.id}
            version={current.version}
            content={current.content}
          />
        ) : (
          <Alert tone="warning">No published guideline exists for this track yet.</Alert>
        )}
      </div>
    </div>
  );
}
