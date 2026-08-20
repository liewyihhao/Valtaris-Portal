import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Stepper } from "@/components/portal/ui/Stepper";
import { Alert } from "@/components/portal/ui/Alert";
import { LinkButton } from "@/components/portal/ui/Button";
import { FUNNEL_STEPS, STAGE_CTA } from "@/lib/portal/funnel";
import { DOMAIN_LABEL, type ApplicationStage } from "@/lib/portal/constants";

export default async function ApplyDashboard() {
  const user = await requireUser();

  // Already a working annotator? Go to the task hub.
  if (user.applicationStage === "approved" && user.role === "annotator") {
    redirect("/dashboard");
  }

  if (!user.emailVerifiedAt) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-p-primary">Verify your email to continue</h1>
        <p className="mt-2 text-sm text-p-secondary">
          You need to verify your email address before starting the application.
        </p>
        <div className="mt-6">
          <Alert tone="warning" title="Email not verified">
            Check the verification link from sign-up. In this local demo you can re-request it from the sign-up screen.
          </Alert>
        </div>
      </div>
    );
  }

  const questionnaire = await prisma.questionnaireResponse.findUnique({
    where: { userId: user.id },
  });
  const routedTracks = (questionnaire?.routedTracks as Record<string, string> | undefined) ?? {};
  const primaryDomain = Object.keys(routedTracks)[0];

  const stage = user.applicationStage as ApplicationStage;
  const cta = STAGE_CTA[stage];

  // For the test stage, deep-link into the routed track's exam if we can find a
  // matching active Track for the primary selected domain.
  let ctaHref = cta.href;
  if (stage === "qualification_test" && primaryDomain) {
    const track = await prisma.track.findFirst({
      where: { domain: primaryDomain as never, isActive: true },
    });
    if (track) ctaHref = `/apply/exam/${track.id}`;
  }
  if (stage === "guidelines" && primaryDomain) {
    const track = await prisma.track.findFirst({
      where: { domain: primaryDomain as never, isActive: true },
    });
    if (track) ctaHref = `/apply/guidelines/${track.id}`;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Your application</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Here&apos;s exactly where you stand. Follow the highlighted step — nothing else is needed right now.
      </p>

      <div className="mt-6">
        <Stepper steps={FUNNEL_STEPS} currentKey={stage} />
      </div>

      <Card className="mt-6">
        <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">What&apos;s next</div>
        <h2 className="mt-2 text-lg font-semibold text-p-primary">{cta.title}</h2>
        {stage === "qualification_test" && primaryDomain && (
          <p className="mt-1 text-sm text-p-secondary">
            Track: {DOMAIN_LABEL[primaryDomain as keyof typeof DOMAIN_LABEL] ?? primaryDomain}.
            Your score sets your tier — self-reported experience doesn&apos;t.
          </p>
        )}
        <div className="mt-5">
          <LinkButton href={ctaHref}>{cta.cta} →</LinkButton>
        </div>
      </Card>

      {questionnaire?.mismatchFlag && (
        <div className="mt-4">
          <Alert tone="info" title="Under review">
            One of your self-ratings didn&apos;t match your calibration answers, so our team is taking a
            quick look. This isn&apos;t a rejection — you can continue the funnel meanwhile.
          </Alert>
        </div>
      )}
    </div>
  );
}
