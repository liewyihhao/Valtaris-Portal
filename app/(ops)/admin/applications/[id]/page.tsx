import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { ApplicationActions } from "@/components/portal/ApplicationActions";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-p-border py-2 text-sm last:border-0">
      <dt className="text-p-secondary">{label}</dt>
      <dd className="text-right text-p-primary">{value || "—"}</dd>
    </div>
  );
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("recruiter");
  const { id } = await params;
  const app = await prisma.contributorApplication.findUnique({ where: { id }, include: { languages: true } });
  if (!app) notFound();

  const statusIntent = app.status === "invited" ? "success" : app.status === "rejected" ? "danger" : "info";

  return (
    <div className="max-w-3xl">
      <Link href="/admin/applications" className="text-xs text-p-accent hover:underline">← Website applications</Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-p-primary">{app.fullName}</h1>
          <p className="mt-1 text-sm text-p-secondary">
            {app.email} · applied for {app.opportunitySlug ?? "General network"} ·{" "}
            <Badge intent={statusIntent} icon={false}>{app.status}</Badge>
          </p>
        </div>
      </div>

      <div className="mt-5">
        <ApplicationActions applicationId={app.id} status={app.status} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-p-secondary">Personal</h2>
          <dl>
            <Row label="Preferred name" value={app.preferredName} />
            <Row label="Phone" value={app.phone} />
            <Row label="Country" value={app.country} />
            <Row label="Location" value={[app.city, app.state].filter(Boolean).join(", ")} />
            <Row label="Timezone" value={app.timezone} />
            <Row label="Preferred contact" value={app.preferredContact} />
          </dl>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-p-secondary">Education & experience</h2>
          <dl>
            <Row label="Highest education" value={app.highestEducation} />
            <Row label="Field of study" value={app.fieldOfStudy} />
            <Row label="Institution" value={app.institution} />
            <Row label="Prior experience" value={app.hasPriorExperience ? `Yes · ${app.yearsExperience ?? ""}` : "No"} />
            <Row label="Hours / week" value={app.hoursPerWeek} />
            <Row label="Start availability" value={app.startAvailability} />
          </dl>
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-p-secondary">Languages</h2>
        <div className="flex flex-wrap gap-2">
          {app.languages.length === 0 && <span className="text-sm text-p-secondary">—</span>}
          {app.languages.map((l) => (
            <Badge key={l.id} intent={l.isStrongest ? "success" : "neutral"} icon={false}>
              {l.languageName}{l.proficiency ? ` · ${l.proficiency}` : ""}{l.isStrongest ? " ★" : ""}
            </Badge>
          ))}
        </div>
      </Card>

      {app.essay && (
        <Card className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-p-secondary">Essay</h2>
          <p className="whitespace-pre-wrap text-sm text-p-primary">{app.essay}</p>
        </Card>
      )}
    </div>
  );
}
