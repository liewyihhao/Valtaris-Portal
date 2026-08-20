import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePM } from "@/lib/portal/session";
import { writeAudit } from "@/lib/portal/audit";

const schema = z.object({
  action: z.enum(["assign", "archive", "remove_member"]),
  taskBatchId: z.string().optional(),
  userId: z.string().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requirePM();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const cohort = await prisma.cohort.findUnique({ where: { id } });
  if (!cohort) return NextResponse.json({ error: "Cohort not found" }, { status: 404 });

  if (parsed.data.action === "assign") {
    if (!parsed.data.taskBatchId) return NextResponse.json({ error: "Pick a project/batch." }, { status: 400 });
    await prisma.cohort.update({ where: { id }, data: { status: "assigned", taskBatchId: parsed.data.taskBatchId } });
    await prisma.cohortMember.updateMany({ where: { cohortId: id, status: "proposed" }, data: { status: "confirmed" } });
    await writeAudit({ entityType: "Cohort", entityId: id, action: "cohort_assigned", actorId: staff.id, after: { taskBatchId: parsed.data.taskBatchId } });
  } else if (parsed.data.action === "archive") {
    await prisma.cohort.update({ where: { id }, data: { status: "archived" } });
    await writeAudit({ entityType: "Cohort", entityId: id, action: "cohort_archived", actorId: staff.id });
  } else if (parsed.data.action === "remove_member") {
    if (!parsed.data.userId) return NextResponse.json({ error: "No member specified." }, { status: 400 });
    await prisma.cohortMember.deleteMany({ where: { cohortId: id, userId: parsed.data.userId } });
  }

  return NextResponse.json({ ok: true });
}
