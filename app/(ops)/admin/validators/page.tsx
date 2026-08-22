import Link from "next/link";
import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { ValidatorRowActions } from "@/components/portal/ValidatorRowActions";
import { DOMAIN_LABEL, VALIDATOR_PASS_THRESHOLD } from "@/lib/portal/constants";

export default async function ValidatorsPage() {
  await requireCapability("validator_ops");

  const caps = await prisma.validatorCapability.findMany({
    include: { user: true, track: true },
    orderBy: { grantedAt: "desc" },
  });

  // Backlog = pending review assignments in each validator's tracks.
  const pendingByTrack = await prisma.reviewAssignment.groupBy({
    by: ["payoutId"],
    where: { decision: null },
  });
  // Simpler: total open review items across the platform (shown as a KPI).
  const openReviews = pendingByTrack.length;
  const active = caps.filter((c) => c.status === "active").length;
  const belowThreshold = caps.filter((c) => (c.calibrationExamScore ?? 0) < VALIDATOR_PASS_THRESHOLD).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Validator management</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Roster per track, calibration accuracy, and backlog. Pause a validator whose calibration drops below the bar.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active validators" value={String(active)} />
        <StatCard label="Open reviews" value={String(openReviews)} sub="awaiting a decision" />
        <StatCard label={`Below ${VALIDATOR_PASS_THRESHOLD}% calibration`} value={String(belowThreshold)} />
      </div>

      <div className="mt-6">
        <Table>
          <THead><TH>Validator</TH><TH>Track</TH><TH>Calibration</TH><TH>Status</TH><TH></TH></THead>
          <TBody>
            {caps.length === 0 && <EmptyRow colSpan={5}>No validators yet.</EmptyRow>}
            {caps.map((c) => {
              const acc = c.calibrationExamScore ?? null;
              const below = acc !== null && acc < VALIDATOR_PASS_THRESHOLD;
              return (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/talent/${c.userId}`} className="text-p-primary hover:text-p-accent">{c.user.fullName ?? c.user.email}</Link>
                  </TD>
                  <TD className="text-p-secondary">{DOMAIN_LABEL[c.track.domain as keyof typeof DOMAIN_LABEL]}</TD>
                  <TD>{acc !== null ? <Badge intent={below ? "danger" : "success"} icon={false}>{Math.round(acc)}%</Badge> : <span className="text-p-secondary">—</span>}</TD>
                  <TD><Badge intent={c.status === "active" ? "success" : c.status === "paused" ? "warning" : "danger"}>{c.status}</Badge></TD>
                  <TD className="text-right"><ValidatorRowActions id={c.id} status={c.status} /></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
