import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { ForecastForm } from "@/components/portal/ForecastForm";

export default async function ForecastPage() {
  await requireCapability("recruiter");
  const [tracks, forecasts] = await Promise.all([
    prisma.track.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workforceForecast.findMany({ orderBy: { generatedAt: "desc" }, take: 50 }),
  ]);
  const trackName = new Map(tracks.map((t) => [t.id, t.name]));
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Capacity forecast</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Project how many active certified annotators an intake will yield, from each track&apos;s historical pass-rate and
        active-rate. Feeds recruitment targets and validator supply planning.
      </p>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-p-primary">Run a projection</h2>
        <ForecastForm tracks={tracks} />
      </Card>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-p-secondary">Saved forecasts</h2>
      <div className="mt-3">
        <Table>
          <THead><TH>Track</TH><TH>Projected intake</TH><TH>Pass rate</TH><TH>Active rate</TH><TH>Projected active output</TH><TH>Generated</TH></THead>
          <TBody>
            {forecasts.length === 0 && <EmptyRow colSpan={6}>No forecasts yet — run a projection above.</EmptyRow>}
            {forecasts.map((f) => (
              <TR key={f.id}>
                <TD className="text-p-primary">{f.trackId ? trackName.get(f.trackId) ?? "—" : "—"}</TD>
                <TD className="tabular-nums text-p-secondary">{f.projectedIntake}</TD>
                <TD className="tabular-nums text-p-secondary">{pct(f.historicalPassRate)}</TD>
                <TD className="tabular-nums text-p-secondary">{pct(f.historicalActiveRate)}</TD>
                <TD className="tabular-nums font-semibold text-p-primary">{f.projectedActiveOutput}</TD>
                <TD className="text-xs text-p-secondary">{f.generatedAt.toLocaleDateString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
