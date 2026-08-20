import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { TIER_LABEL, DOMAIN_LABEL, type Tier } from "@/lib/portal/constants";
import type { Prisma } from "@prisma/client";

export default async function WorkersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const tier = sp.tier ?? "";
  const trackId = sp.track ?? "";

  const tracks = await prisma.track.findMany({ where: { isActive: true }, select: { id: true, name: true } });

  const qualWhere: Prisma.QualificationWhereInput = { status: "active" };
  if (tier) qualWhere.tier = tier as Tier;
  if (trackId) qualWhere.trackId = trackId;

  const users = await prisma.user.findMany({
    where: {
      role: { in: ["annotator", "ops", "admin"] },
      ...(q ? { email: { contains: q } } : {}), // SQLite LIKE is ASCII case-insensitive
      qualifications: { some: qualWhere },
    },
    include: { qualifications: { where: qualWhere, include: { track: true } } },
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Worker pool</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Answer &quot;give me N qualified annotators for X&quot; — filter by track, tier, and more.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs text-p-secondary">Email contains</label>
          <input name="q" defaultValue={q} className="rounded-lg border border-p-border bg-p-surface-2 px-3 py-2 text-sm text-p-primary" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-p-secondary">Track</label>
          <select name="track" defaultValue={trackId} className="rounded-lg border border-p-border bg-p-surface-2 px-3 py-2 text-sm text-p-primary">
            <option value="">Any</option>
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-p-secondary">Tier</label>
          <select name="tier" defaultValue={tier} className="rounded-lg border border-p-border bg-p-surface-2 px-3 py-2 text-sm text-p-primary">
            <option value="">Any</option>
            {(["T1_associate", "T2_skilled", "T3_specialist"] as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
          </select>
        </div>
        <button className="rounded-lg bg-p-accent px-4 py-2 text-sm font-semibold text-[#08111f]">Filter</button>
      </form>

      <div className="mt-6">
        <Table>
          <THead><TH>Annotator</TH><TH>Country</TH><TH>Qualified tracks</TH></THead>
          <TBody>
            {users.length === 0 && <EmptyRow colSpan={3}>No workers match these filters.</EmptyRow>}
            {users.map((u) => (
              <TR key={u.id}>
                <TD>
                  <div className="text-p-primary">{u.fullName ?? u.email}</div>
                  <div className="text-xs text-p-secondary">{u.email}</div>
                </TD>
                <TD className="text-p-secondary">{u.country}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1.5">
                    {u.qualifications.map((ql) => (
                      <Badge key={ql.id} intent="info" icon={false}>
                        {DOMAIN_LABEL[ql.track.domain as keyof typeof DOMAIN_LABEL]} · {TIER_LABEL[ql.tier as Tier].split(" · ")[0]}
                      </Badge>
                    ))}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
