import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { notify } from "@/lib/portal/notify";

const schema = z.object({
  category: z.enum(["payout_issue", "exam_dispute", "account_access", "technical_bug", "policy_question", "other"]),
  subject: z.string().min(3),
  body: z.string().min(5),
});

// Payout issues get the fastest SLA (highest trust impact), mirroring the
// appeal SLA pattern. exam_dispute is nudged toward the appeal flow client-side.
const PRIORITY: Record<string, string> = { payout_issue: "high", account_access: "high", exam_dispute: "normal", technical_bug: "normal", policy_question: "low", other: "low" };

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Subject and details are required." }, { status: 400 });

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      category: parsed.data.category,
      subject: parsed.data.subject,
      body: parsed.data.body,
      priority: PRIORITY[parsed.data.category] ?? "normal",
    },
  });
  await notify({
    userId: user.id,
    category: "support",
    title: "We received your ticket",
    body: `Ticket "${parsed.data.subject}" is open. We'll follow up per the published SLA.`,
    deepLink: "/help",
  });
  return NextResponse.json({ ok: true, id: ticket.id });
}
