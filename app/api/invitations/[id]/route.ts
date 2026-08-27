import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { writeAudit } from "@/lib/portal/audit";

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

  return NextResponse.json({ ok: true, status });
}
