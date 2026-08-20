import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Write an audit-log row on every meaningful state transition (Qualification
// and Payout at minimum). This is the record needed for any future payment or
// qualification dispute.
export async function writeAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId ?? null,
      before: params.before,
      after: params.after,
    },
  });
}
