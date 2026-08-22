import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";

const schema = z.object({ action: z.enum(["pause", "resume", "revoke"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user: staff } = await requireCapability("validator_ops");
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const cap = await prisma.validatorCapability.findUnique({ where: { id } });
  if (!cap) return NextResponse.json({ error: "Capability not found" }, { status: 404 });

  const status = parsed.data.action === "pause" ? "paused" : parsed.data.action === "resume" ? "active" : "revoked";
  await prisma.validatorCapability.update({ where: { id }, data: { status } });
  await writeAudit({
    entityType: "ValidatorCapability",
    entityId: id,
    action: `validator_${parsed.data.action}`,
    actorId: staff.id,
    after: { status },
  });
  return NextResponse.json({ ok: true });
}
