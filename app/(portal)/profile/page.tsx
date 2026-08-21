import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { LinkButton } from "@/components/portal/ui/Button";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { TIER_LABEL, DOMAIN_LABEL, type Tier } from "@/lib/portal/constants";

export default async function ProfilePage() {
  const user = await requireUser();
  if (user.role === "applicant") redirect("/apply");

  const quals = await prisma.qualification.findMany({
    where: { userId: user.id },
    include: { track: true },
    orderBy: { verifiedAt: "desc" },
  });
  const questionnaire = await prisma.questionnaireResponse.findUnique({ where: { userId: user.id } });
  const languages = (questionnaire?.answers as { languages?: { code: string; proficiency: string }[] } | undefined)?.languages ?? [];
  const validatorCaps = await prisma.validatorCapability.findMany({ where: { userId: user.id }, include: { track: true } });
  const capByTrack = new Map(validatorCaps.map((c) => [c.trackId, c]));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Profile &amp; qualifications</h1>
      <p className="mt-1 text-sm text-p-secondary">Your standing across tracks. Tier is set only by test performance.</p>

      <Card className="mt-6">
        <div className="text-xs uppercase tracking-wide text-p-secondary">Account</div>
        <div className="mt-2 text-sm text-p-primary">{user.fullName ?? user.email}</div>
        <div className="text-sm text-p-secondary">{user.email} · {user.country}</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {languages.map((l) => (
            <Badge key={l.code} intent="neutral" icon={false}>{l.code} · {l.proficiency}</Badge>
          ))}
        </div>
      </Card>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Qualified tracks</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Track</TH><TH>Domain</TH><TH>Tier</TH><TH>Recert due</TH></THead>
          <TBody>
            {quals.length === 0 && <EmptyRow colSpan={4}>No qualifications yet.</EmptyRow>}
            {quals.map((q) => (
              <TR key={q.id}>
                <TD className="text-p-primary">{q.track.name}</TD>
                <TD className="text-p-secondary">{DOMAIN_LABEL[q.track.domain as keyof typeof DOMAIN_LABEL]}</TD>
                <TD><Badge intent="info" icon={false}>{TIER_LABEL[q.tier as Tier]}</Badge></TD>
                <TD className="text-xs text-p-secondary">{q.recertDueAt ? q.recertDueAt.toLocaleDateString() : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Validator status</h2>
      <p className="mt-1 text-sm text-p-secondary">Validating is the rung above T2 Skilled — you review peers&apos; work and are paid per review.</p>
      <div className="mt-3 space-y-2">
        {quals.filter((q) => q.tier === "T2_skilled" || q.tier === "T3_specialist").length === 0 && (
          <p className="text-sm text-p-secondary">Reach T2 Skilled in a track to unlock Validator eligibility.</p>
        )}
        {quals
          .filter((q) => q.tier === "T2_skilled" || q.tier === "T3_specialist")
          .map((q) => {
            const cap = capByTrack.get(q.trackId);
            return (
              <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-p-border px-3 py-2.5">
                <span className="text-sm text-p-primary">
                  {DOMAIN_LABEL[q.track.domain as keyof typeof DOMAIN_LABEL]}
                  {cap && <span className="ml-2 text-xs text-p-secondary">calibration {cap.calibrationExamScore ? `${Math.round(cap.calibrationExamScore)}%` : "—"}</span>}
                </span>
                {cap ? (
                  <Badge intent={cap.status === "active" ? "success" : cap.status === "paused" ? "warning" : "danger"} icon={false}>
                    Validator · {cap.status}
                  </Badge>
                ) : (
                  <LinkButton href={`/apply/validator-exam/${q.trackId}`} variant="secondary" size="sm">Apply to become a Validator →</LinkButton>
                )}
              </div>
            );
          })}
      </div>

      <div className="mt-6">
        <LinkButton href="/apply/questionnaire" variant="secondary">Apply for an additional track →</LinkButton>
      </div>
    </div>
  );
}
