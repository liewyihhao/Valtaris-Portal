import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/portal/ui/Table";

export default async function LabelStudioAdminPage() {
  const mappings = await prisma.labelStudioMapping.findMany({ include: { track: true }, orderBy: { createdAt: "asc" } });
  const accounts = await prisma.labelStudioAccount.groupBy({ by: ["provisioningStatus"], _count: true });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Label Studio mapping</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Which track/client maps to which Label Studio instance &amp; project, plus invite-link management.
      </p>

      <div className="mt-4">
        <Alert tone="info" title="Community Edition has no per-project access control">
          Access is controlled here, not inside Label Studio. Invite links are only ever issued to annotators whose
          tier for the track is already verified server-side. See docs/architecture.md.
        </Alert>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {accounts.map((a) => (
          <Badge key={a.provisioningStatus} intent={a.provisioningStatus === "provisioned" ? "success" : "warning"} icon={false}>
            {a._count} account(s) · {a.provisioningStatus}
          </Badge>
        ))}
      </div>

      <div className="mt-6">
        <Table>
          <THead><TH>Track</TH><TH>Instance URL</TH><TH>Project ID</TH><TH>Guideline sync</TH><TH>Invite link</TH></THead>
          <TBody>
            {mappings.length === 0 && <EmptyRow colSpan={5}>No mappings configured yet.</EmptyRow>}
            {mappings.map((m) => (
              <TR key={m.id}>
                <TD className="text-p-primary">{m.track.name}</TD>
                <TD className="text-xs text-p-secondary">{m.labelStudioInstanceUrl}</TD>
                <TD className="text-p-secondary">{m.labelStudioProjectId}</TD>
                <TD className="text-p-secondary">{m.guidelineVersionSynced ? `v${m.guidelineVersionSynced}` : "—"}</TD>
                <TD>
                  {m.inviteLink ? (
                    <code className="rounded bg-p-surface-2 px-2 py-0.5 text-xs text-p-secondary">{m.inviteLink}</code>
                  ) : (
                    <span className="text-xs text-p-disabled">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <div className="mt-6">
        <Card>
          <div className="text-sm font-semibold text-p-primary">Provisioning is a manual/semi-automated step</div>
          <p className="mt-2 text-sm text-p-secondary">
            Community Edition doesn&apos;t document a public user-creation API. Provision annotator accounts via the
            documented invite-link flow or the <code className="text-p-primary">label-studio</code> CLI, then store the
            resulting <code className="text-p-primary">label_studio_user_id</code> against the annotator. See the README follow-up item.
          </p>
        </Card>
      </div>
    </div>
  );
}
