import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";

const schema = z.object({ action: z.enum(["activate", "deactivate"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await requireCapability("recruiter");
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const isActive = parsed.data.action === "activate";
  await prisma.taskBatch.update({ where: { id }, data: { isActive } });
  await writeAudit({
    entityType: "TaskBatch",
    entityId: id,
    action: isActive ? "project_activated" : "project_deactivated",
    actorId: user.id,
  });
  return NextResponse.json({ ok: true });
}
