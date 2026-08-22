import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";

const schema = z.object({
  name: z.string().min(3),
  clientName: z.string().nullable().optional(),
  userIds: z.array(z.string()).min(1),
  criteria: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const { user: staff } = await requireCapability("recruiter");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Name and at least one annotator are required." }, { status: 400 });

  const cohort = await prisma.cohort.create({
    data: {
      name: parsed.data.name,
      clientName: parsed.data.clientName ?? null,
      createdById: staff.id,
      status: "draft",
      criteria: (parsed.data.criteria ?? {}) as object,
      members: { create: parsed.data.userIds.map((userId) => ({ userId, status: "proposed" })) },
    },
  });

  await writeAudit({
    entityType: "Cohort",
    entityId: cohort.id,
    action: "cohort_created",
    actorId: staff.id,
    after: { name: cohort.name, size: parsed.data.userIds.length },
  });

  return NextResponse.json({ ok: true, id: cohort.id });
}
