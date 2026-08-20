import { prisma } from "@/lib/db";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";
import { Badge } from "@/components/portal/ui/Badge";

export default async function AdminGuidelinesPage() {
  const versions = await prisma.guidelineVersion.findMany({
    include: { track: true, _count: { select: { acks: true } } },
    orderBy: [{ trackId: "asc" }, { version: "desc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Guideline documents &amp; versions</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Version history per track. Bumping a version re-prompts annotators to re-acknowledge before their next task pull.
      </p>

      <div className="mt-6">
        <Table>
          <THead><TH>Track</TH><TH>Title</TH><TH>Version</TH><TH>Published</TH><TH>Acknowledgments</TH></THead>
          <TBody>
            {versions.length === 0 && <EmptyRow colSpan={5}>No guideline versions yet.</EmptyRow>}
            {versions.map((v) => (
              <TR key={v.id}>
                <TD className="text-p-primary">{v.track.name}</TD>
                <TD className="text-p-secondary">{v.title}</TD>
                <TD>{v.isCurrent ? <Badge intent="success" icon={false}>v{v.version} · current</Badge> : <Badge intent="neutral" icon={false}>v{v.version}</Badge>}</TD>
                <TD className="text-xs text-p-secondary">{v.publishedAt.toLocaleDateString()}</TD>
                <TD className="text-p-secondary">{v._count.acks}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
