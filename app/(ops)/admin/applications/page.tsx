import Link from "next/link";
import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { Card, StatCard } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";

// Website-sourced application intake (marketing site → Portal handoff). Ops
// reviews these and promotes applicants into the funnel.
export default async function ApplicationsPage() {
  await requireCapability("recruiter");
  const [apps, newCount] = await Promise.all([
    prisma.contributorApplication.findMany({
      include: { languages: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.contributorApplication.count({ where: { status: "NEW" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Website applications</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Contributor applications forwarded from the marketing site (<span className="font-mono text-xs">/api/ingest/applications</span>).
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total intake" value={String(apps.length)} />
        <StatCard label="New (unreviewed)" value={String(newCount)} />
        <StatCard label="With résumé" value={String(apps.filter((a) => a.resumePath).length)} />
      </div>

      <div className="mt-6">
        <Table>
          <THead><TH>Applicant</TH><TH>Position</TH><TH>Country</TH><TH>Languages</TH><TH>Received</TH><TH>Status</TH></THead>
          <TBody>
            {apps.length === 0 && <EmptyRow colSpan={6}>No applications yet — submit one from the website to test the handoff.</EmptyRow>}
            {apps.map((a) => (
              <TR key={a.id}>
                <TD>
                  <Link href={`/admin/applications/${a.id}`} className="text-p-primary hover:text-p-accent">{a.fullName}</Link>
                  <div className="text-xs text-p-secondary">{a.email}</div>
                </TD>
                <TD className="text-p-secondary">{a.opportunitySlug ?? "General network"}</TD>
                <TD className="text-p-secondary">{a.country ?? "—"}</TD>
                <TD className="text-xs text-p-secondary">
                  {a.languages.map((l) => `${l.languageName}${l.isStrongest ? "*" : ""}`).join(", ") || "—"}
                </TD>
                <TD className="whitespace-nowrap text-xs text-p-secondary">{a.createdAt.toLocaleString()}</TD>
                <TD><Badge intent={a.status === "NEW" ? "info" : a.status === "invited" ? "success" : a.status === "rejected" ? "danger" : "neutral"} icon={false}>{a.status}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
