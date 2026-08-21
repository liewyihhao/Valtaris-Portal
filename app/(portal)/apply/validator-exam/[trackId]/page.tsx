import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { validatorEligible } from "@/lib/portal/validator";
import { VALIDATOR_SCENARIOS } from "@/lib/portal/validator-exam";
import { ValidatorExam } from "@/components/portal/ValidatorExam";
import { Alert } from "@/components/portal/ui/Alert";
import { DOMAIN_LABEL } from "@/lib/portal/constants";

export default async function ValidatorExamPage({ params }: { params: Promise<{ trackId: string }> }) {
  const user = await requireUser();
  const { trackId } = await params;
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) notFound();
  if (user.role === "applicant") redirect("/apply");

  const { eligible, reasons } = await validatorEligible(user.id, trackId);

  return (
    <div>
      <Link href="/profile" className="text-sm text-p-secondary hover:text-p-primary">← Profile</Link>
      <h1 className="mt-2 text-2xl font-semibold text-p-primary">
        Validator Calibration Exam — {DOMAIN_LABEL[track.domain as keyof typeof DOMAIN_LABEL]}
      </h1>
      <p className="mt-1 text-sm text-p-secondary">
        Judge whether each annotator&apos;s label is correct. Pass bar is 85%. This is the same golden-task pattern as your
        qualification exam, one level up — you&apos;re judging someone else&apos;s judgment.
      </p>

      {!eligible ? (
        <div className="mt-5">
          <Alert tone="warning" title="Not eligible yet">
            You need T2+ in this track, an active account, and no recent disciplinary flags. Missing: {reasons.join(", ")}.
          </Alert>
        </div>
      ) : (
        <div className="mt-5">
          <ValidatorExam
            trackId={trackId}
            scenarios={VALIDATOR_SCENARIOS.map((s) => ({ id: s.id, item: s.item, submittedLabel: s.submittedLabel }))}
          />
        </div>
      )}
    </div>
  );
}
