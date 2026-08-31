import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { writeAudit } from "@/lib/portal/audit";
import { createProjectCredential } from "@/lib/portal/project-credential";
import { sendEmail } from "@/lib/portal/email";

const schema = z.object({ action: z.enum(["accept", "decline"]) });

// The annotator accepts or declines a project invitation (their own only).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const member = await prisma.cohortMember.findUnique({ where: { id } });
  if (!member || member.userId !== user.id) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }
  if (member.status !== "invited") {
    return NextResponse.json({ error: "This invitation is no longer open." }, { status: 409 });
  }

  const status = parsed.data.action === "accept" ? "accepted" : "declined";
  await prisma.cohortMember.update({ where: { id }, data: { status } });
  await writeAudit({
    entityType: "CohortMember",
    entityId: id,
    action: `invitation_${status}`,
    actorId: user.id,
    after: { cohortId: member.cohortId, status },
  });

  // On accept, if the cohort is assigned to a project, issue a project-scoped
  // login and email the worker a setup link (verification + set project password).
  let setupUrl: string | null = null;
  if (status === "accepted") {
    const cohort = await prisma.cohort.findUnique({ where: { id: member.cohortId }, include: { taskBatch: true } });
    if (cohort?.taskBatchId && cohort.taskBatch) {
      const { setupUrl: url } = await createProjectCredential(user.id, cohort.taskBatchId);
      setupUrl = url;
      await sendEmail({
        to: user.email,
        subject: `Set up your access for ${cohort.taskBatch.taskType}`,
        body: `Hi ${user.fullName ?? "there"},\n\nThanks for accepting the ${cohort.taskBatch.taskType} project (${cohort.taskBatch.clientName}).\n\nSet up your project login (verify + choose a password) here:\n${url}\n\nOnce set up, you'll find the project in your Projects section.\n\n— The Valtaris Team`,
      });
    }
  }

  return NextResponse.json({ ok: true, status, setupUrl });
}
