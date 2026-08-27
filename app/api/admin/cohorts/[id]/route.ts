import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";
import { notify } from "@/lib/portal/notify";
import { t } from "@/lib/portal/i18n";

const schema = z.object({
  action: z.enum(["assign", "archive", "remove_member"]),
  taskBatchId: z.string().optional(),
  userId: z.string().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user: staff } = await requireCapability("recruiter");
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const cohort = await prisma.cohort.findUnique({ where: { id } });
  if (!cohort) return NextResponse.json({ error: "Cohort not found" }, { status: 404 });

  if (parsed.data.action === "assign") {
    if (!parsed.data.taskBatchId) return NextResponse.json({ error: "Pick a project/batch." }, { status: 400 });
    const batch = await prisma.taskBatch.findUnique({ where: { id: parsed.data.taskBatchId }, include: { track: true } });
    if (!batch) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    await prisma.cohort.update({ where: { id }, data: { status: "assigned", taskBatchId: parsed.data.taskBatchId } });
    // Assigning invites the selected annotators — they accept/decline in their
    // portal — rather than silently confirming them.
    const members = await prisma.cohortMember.findMany({ where: { cohortId: id, status: { in: ["proposed", "invited"] } } });
    await prisma.cohortMember.updateMany({ where: { cohortId: id, status: { in: ["proposed", "invited"] } }, data: { status: "invited" } });
    await writeAudit({ entityType: "Cohort", entityId: id, action: "cohort_assigned", actorId: staff.id, after: { taskBatchId: parsed.data.taskBatchId, invited: members.length } });

    for (const m of members) {
      await notify({
        userId: m.userId,
        category: "project",
        title: t("notif.project.invited.title"),
        body: t("notif.project.invited.body", { project: batch.taskType, track: batch.track.name }),
        deepLink: "/invitations",
        email: true,
      });
    }
  } else if (parsed.data.action === "archive") {
    await prisma.cohort.update({ where: { id }, data: { status: "archived" } });
    await writeAudit({ entityType: "Cohort", entityId: id, action: "cohort_archived", actorId: staff.id });
  } else if (parsed.data.action === "remove_member") {
    if (!parsed.data.userId) return NextResponse.json({ error: "No member specified." }, { status: 400 });
    await prisma.cohortMember.deleteMany({ where: { cohortId: id, userId: parsed.data.userId } });
  }

  return NextResponse.json({ ok: true });
}
