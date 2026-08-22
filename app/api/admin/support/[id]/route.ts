import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { notify } from "@/lib/portal/notify";
import { t } from "@/lib/portal/i18n";

const schema = z.object({ status: z.enum(["in_progress", "resolved", "closed"]), note: z.string().optional() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireCapability("support");
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolutionNote: parsed.data.note ?? undefined,
      resolvedAt: parsed.data.status === "resolved" || parsed.data.status === "closed" ? new Date() : null,
    },
  });
  if (parsed.data.status === "resolved") {
    await notify({ userId: ticket.userId, category: "support", title: t("notif.support.resolved.title"), body: parsed.data.note ?? `"${ticket.subject}" is resolved.`, deepLink: "/help" });
  }
  return NextResponse.json({ ok: true });
}
