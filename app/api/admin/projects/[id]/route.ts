import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";
import { provisionStudioProject } from "@/lib/portal/project-provision";

const schema = z.object({ action: z.enum(["activate", "deactivate", "provision", "review", "deliver", "reopen"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await requireCapability("recruiter");
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Manual (re)provision of the Studio counterpart — e.g. after LS is configured.
  if (parsed.data.action === "provision") {
    const result = await provisionStudioProject(id, user.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.configured === false ? 400 : 502 });
    return NextResponse.json({ ok: true, studioProjectId: result.projectId, alreadyProvisioned: result.alreadyProvisioned ?? false });
  }

  // Delivery lifecycle: send for final review → deliver (file to client) → reopen.
  if (parsed.data.action === "review" || parsed.data.action === "deliver" || parsed.data.action === "reopen") {
    const deliveryStatus = parsed.data.action === "deliver" ? "delivered" : parsed.data.action === "review" ? "in_review" : "in_progress";
    const delivered = parsed.data.action === "deliver";
    await prisma.taskBatch.update({
      where: { id },
      data: {
        deliveryStatus,
        deliveredAt: delivered ? new Date() : null,
        deliveredById: delivered ? user.id : null,
      },
    });
    await writeAudit({ entityType: "TaskBatch", entityId: id, action: `project_${parsed.data.action}`, actorId: user.id, after: { deliveryStatus } });
    return NextResponse.json({ ok: true, deliveryStatus });
  }

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
