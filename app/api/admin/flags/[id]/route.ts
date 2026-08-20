import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/portal/session";
import { writeAudit } from "@/lib/portal/audit";

const schema = z.object({ action: z.enum(["resolve", "dismiss"]), note: z.string().optional() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const flag = await prisma.reviewFlag.findUnique({ where: { id } });
  if (!flag) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

  await prisma.reviewFlag.update({
    where: { id },
    data: {
      status: parsed.data.action === "resolve" ? "resolved" : "dismissed",
      note: parsed.data.note ?? flag.note,
      resolvedAt: new Date(),
      resolvedById: staff.id,
    },
  });

  await writeAudit({
    entityType: "ReviewFlag",
    entityId: id,
    action: parsed.data.action,
    actorId: staff.id,
    after: { status: parsed.data.action === "resolve" ? "resolved" : "dismissed" },
  });

  return NextResponse.json({ ok: true });
}
