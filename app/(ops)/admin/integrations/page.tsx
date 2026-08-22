import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Alert } from "@/components/portal/ui/Alert";
import { ServiceAccountManager } from "@/components/portal/ServiceAccountManager";
import { SERVICE_SCOPES } from "@/lib/portal/service-account";

export default async function IntegrationsPage() {
  await requireCapability("executive");
  const accounts = await prisma.serviceAccount.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Integrations &amp; service accounts</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Scoped API keys for system-to-system access — the auth model for the future Label Studio bridge (master design §9).
        Keys authenticate via <span className="font-mono text-xs">Authorization: Bearer &lt;key&gt;</span>; only a hash is stored.
      </p>

      <div className="mt-4">
        <Alert tone="info" title="What the bridge can do">
          <ul className="ml-4 list-disc text-sm">
            <li><span className="font-mono text-xs">worksummary:write</span> — POST <span className="font-mono text-xs">/api/integration/work-summary</span> (rows tagged with the account name as sourceSystem).</li>
            <li><span className="font-mono text-xs">standing:read</span> — GET <span className="font-mono text-xs">/api/integration/standing?userId=…</span> (tier, account + validator status).</li>
          </ul>
        </Alert>
      </div>

      <Card className="mt-6">
        <ServiceAccountManager
          allScopes={[...SERVICE_SCOPES]}
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            scopes: a.scopes,
            keyPrefix: a.keyPrefix,
            lastUsedAt: a.lastUsedAt ? a.lastUsedAt.toISOString() : null,
            revokedAt: a.revokedAt ? a.revokedAt.toISOString() : null,
          }))}
        />
      </Card>
    </div>
  );
}
