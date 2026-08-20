import { requirePM } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { buildTalentWhere, talentInclude, type TalentFilters } from "@/lib/portal/talent";
import { TalentSelection, type TalentRow } from "@/components/portal/TalentSelection";
import { TIER_LABEL, DOMAIN_LABEL, KYC_LABEL, type Tier } from "@/lib/portal/constants";
import { LANGUAGES, COUNTRIES } from "@/lib/portal/options";

export default async function TalentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePM();
  const sp = await searchParams;

  const filters: TalentFilters = {
    q: sp.q || undefined,
    trackId: sp.track || undefined,
    minTier: (sp.minTier as Tier) || undefined,
    language: sp.language || undefined,
    country: sp.country || undefined,
    surgeOnly: sp.surge === "1",
    kycLevel: sp.kyc || undefined,
    status: sp.status || undefined,
    minAccuracy: sp.minAccuracy ? Number(sp.minAccuracy) / 100 : undefined,
  };

  const tracks = await prisma.track.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const users = await prisma.user.findMany({
    where: buildTalentWhere(filters),
    include: talentInclude,
    take: 200,
    orderBy: { createdAt: "desc" },
  });

  const rows: TalentRow[] = users.map((u) => {
    const best = u.performanceMetrics.reduce<number | null>(
      (m, pm) => (pm.rollingAccuracy != null && (m == null || pm.rollingAccuracy > m) ? pm.rollingAccuracy : m),
      null
    );
    return {
      id: u.id,
      name: u.fullName ?? u.email,
      email: u.email,
      country: u.country,
      status: u.status,
      tiers: u.qualifications.map((q) => ({
        track: DOMAIN_LABEL[q.track.domain as keyof typeof DOMAIN_LABEL] ?? q.track.name,
        tier: TIER_LABEL[q.tier as Tier].split(" · ")[0],
      })),
      languages: u.annotatorLanguages.map((l) => l.language),
      surge: u.availability?.surgeOptIn ?? false,
      kyc: u.trustProfile?.kycLevel ?? "none",
      accuracy: best,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Talent pool</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Screen, filter, and select qualified annotators — then build a cohort for a project. {users.length} match.
      </p>

      <form method="get" className="mt-5 grid gap-3 rounded-xl border border-p-border bg-p-surface p-4 sm:grid-cols-3 lg:grid-cols-4">
        <Sel name="q" label="Name / email" value={sp.q} input />
        <Sel name="track" label="Track" value={sp.track} options={[["", "Any"], ...tracks.map((t) => [t.id, t.name] as [string, string])]} />
        <Sel name="minTier" label="Min tier" value={sp.minTier} options={[["", "Any"], ["T1_associate", "T1+"], ["T2_skilled", "T2+"], ["T3_specialist", "T3"]]} />
        <Sel name="language" label="Language" value={sp.language} options={[["", "Any"], ...LANGUAGES.map((l) => [l, l] as [string, string])]} />
        <Sel name="country" label="Region" value={sp.country} options={[["", "Any"], ...COUNTRIES.map((c) => [c, c] as [string, string])]} />
        <Sel name="kyc" label="KYC level" value={sp.kyc} options={[["", "Any"], ["email_phone", KYC_LABEL.email_phone], ["id_biometric", KYC_LABEL.id_biometric]]} />
        <Sel name="minAccuracy" label="Min accuracy %" value={sp.minAccuracy} input />
        <Sel name="status" label="Status" value={sp.status} options={[["", "Any"], ["active", "Active"], ["dormant", "Dormant"], ["suspended", "Suspended"]]} />
        <label className="flex items-end gap-2 text-sm text-p-primary">
          <input type="checkbox" name="surge" value="1" defaultChecked={sp.surge === "1"} className="h-4 w-4 accent-[#5b8def]" /> Surge-ready only
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-lg bg-p-accent px-4 py-2 text-sm font-semibold text-[#08111f]">Filter</button>
          <a href="/admin/talent" className="rounded-lg border border-p-border px-4 py-2 text-sm text-p-secondary">Reset</a>
        </div>
      </form>

      <div className="mt-5">
        <TalentSelection rows={rows} />
      </div>
    </div>
  );
}

function Sel({
  name, label, value, options, input,
}: {
  name: string; label: string; value?: string; options?: [string, string][]; input?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-p-secondary">{label}</label>
      {input ? (
        <input name={name} defaultValue={value ?? ""} className="w-full rounded-lg border border-p-border bg-p-surface-2 px-3 py-2 text-sm text-p-primary" />
      ) : (
        <select name={name} defaultValue={value ?? ""} className="w-full rounded-lg border border-p-border bg-p-surface-2 px-3 py-2 text-sm text-p-primary">
          {(options ?? []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
    </div>
  );
}
