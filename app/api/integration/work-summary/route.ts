import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateServiceAccount } from "@/lib/portal/service-account";

// The defined inbound contract (master design §2.4/§9). The bridge POSTs
// WorkSummary rows; sourceSystem is the calling account's name (e.g.
// "label_studio"), so internal vs. bridge-sourced rows are distinguishable in
// My Work. Idempotent: a retried push updates the row for the same
// (worker, period, task, source) rather than duplicating it (§5).
const rowSchema = z.object({
  userId: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  taskType: z.string().min(1),
  unitsCompleted: z.number().int().min(0).default(0),
  unitsApproved: z.number().int().min(0).default(0),
  unitsRejected: z.number().int().min(0).default(0),
  avgQualityScore: z.number().min(0).max(1).nullable().optional(),
});
const schema = z.object({ summaries: z.array(rowSchema).min(1).max(1000) });

export async function POST(req: Request) {
  const auth = await authenticateServiceAccount(req, "worksummary:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  // The account's name is the source-system tag for every row it writes.
  const sourceSystem = auth.account.name;

  // Validate all referenced workers exist before writing anything.
  const userIds = [...new Set(parsed.data.summaries.map((s) => s.userId))];
  const known = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
  const knownSet = new Set(known.map((u) => u.id));
  const unknown = userIds.filter((id) => !knownSet.has(id));
  if (unknown.length > 0) {
    return NextResponse.json({ error: "Unknown userId(s).", unknownUserIds: unknown }, { status: 422 });
  }

  let written = 0;
  for (const s of parsed.data.summaries) {
    await prisma.workSummary.upsert({
      where: {
        userId_periodStart_periodEnd_taskType_sourceSystem: {
          userId: s.userId,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          taskType: s.taskType,
          sourceSystem,
        },
      },
      create: {
        userId: s.userId,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        taskType: s.taskType,
        unitsCompleted: s.unitsCompleted,
        unitsApproved: s.unitsApproved,
        unitsRejected: s.unitsRejected,
        avgQualityScore: s.avgQualityScore ?? null,
        sourceSystem,
      },
      update: {
        unitsCompleted: s.unitsCompleted,
        unitsApproved: s.unitsApproved,
        unitsRejected: s.unitsRejected,
        avgQualityScore: s.avgQualityScore ?? null,
      },
    });
    written += 1;
  }

  return NextResponse.json({ ok: true, written, sourceSystem });
}
