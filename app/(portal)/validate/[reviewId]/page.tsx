import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { getActiveValidatorTrackIds } from "@/lib/portal/validator";
import { Card } from "@/components/portal/ui/Card";
import { Alert } from "@/components/portal/ui/Alert";
import { ReviewDecision } from "@/components/portal/ReviewDecision";
import { DOMAIN_LABEL } from "@/lib/portal/constants";

// Anonymize the annotator as a stable pseudonym (anti-favoritism, spec §2.4).
function pseudonym(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `Annotator #${(h % 9000) + 1000}`;
}

export default async function ReviewInterface({ params }: { params: Promise<{ reviewId: string }> }) {
  const user = await requireUser();
  const { reviewId } = await params;
  const ra = await prisma.reviewAssignment.findUnique({
    where: { id: reviewId },
    include: { payout: { include: { taskBatch: { include: { track: true } } } } },
  });
  if (!ra) notFound();

  const trackId = ra.payout.taskBatch.trackId;
  const activeTracks = await getActiveValidatorTrackIds(user.id);
  if (!activeTracks.includes(trackId)) redirect("/validate");
  if (ra.payout.userId === user.id) redirect("/validate"); // never review own work
  const alreadyDecided = !!ra.decision;

  return (
    <div>
      <Link href="/validate" className="text-sm text-p-secondary hover:text-p-primary">← Validator queue</Link>
      <h1 className="mt-2 text-2xl font-semibold text-p-primary">Review submission</h1>
      <p className="mt-1 text-sm text-p-secondary">
        {DOMAIN_LABEL[ra.payout.taskBatch.track.domain as keyof typeof DOMAIN_LABEL]} · {ra.payout.taskBatch.taskType} · routed: {ra.routedReason}
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="text-xs uppercase tracking-wide text-p-secondary">Original item</div>
          <p className="mt-2 text-sm text-p-primary">
            {(ra.payout.labelStudioTaskId ? `Label Studio task ${ra.payout.labelStudioTaskId}` : "Task item")} —
            open in Studio for the full context.
          </p>
          <a href="/api/studio/sso" className="mt-3 inline-block text-sm text-p-accent hover:underline">Open in Valtaris Studio →</a>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-p-secondary">Submitted by {pseudonym(ra.payout.userId)}</div>
          <p className="mt-2 text-sm text-p-primary">Item count: {ra.payout.itemCount}</p>
          <p className="mt-1 text-xs text-p-secondary">Identity anonymized to reduce favouritism/retaliation risk.</p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="text-xs uppercase tracking-wide text-p-secondary">Decision</div>
        <p className="mt-1 mb-3 text-sm text-p-secondary">
          Reject requires a reason code from the controlled taxonomy — never free text alone. Use Request Correction for a
          fixable, non-fraud issue; Escalate for anything beyond your call.
        </p>
        {alreadyDecided ? (
          <Alert tone="info" title="Already decided">This review was resolved as &quot;{ra.decision}&quot;.</Alert>
        ) : (
          <ReviewDecision reviewId={ra.id} />
        )}
      </Card>
    </div>
  );
}
