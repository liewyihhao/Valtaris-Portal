import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { furthestStage } from "@/lib/portal/funnel";

const schema = z.object({ guidelineVersionId: z.string() });

export async function POST(req: Request, ctx: { params: Promise<{ trackId: string }> }) {
  const user = await requireUser();
  const { trackId } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const gv = await prisma.guidelineVersion.findUnique({ where: { id: parsed.data.guidelineVersionId } });
  if (!gv || gv.trackId !== trackId) {
    return NextResponse.json({ error: "Guideline not found" }, { status: 404 });
  }

  await prisma.guidelineAcknowledgment.create({
    data: {
      userId: user.id,
      trackId,
      guidelineVersionId: gv.id,
      version: gv.version,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { applicationStage: furthestStage(user.applicationStage, "agreements") },
  });

  return NextResponse.json({ ok: true });
}
