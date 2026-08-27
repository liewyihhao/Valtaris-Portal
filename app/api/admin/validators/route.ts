import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";

const schema = z.object({ userId: z.string().min(1), trackId: z.string().min(1) });

// Admin-assign the validator role to a worker for a track. This is a deliberate
// ops override of the exam-earned path (a worker normally earns the capability
// via the calibration exam) — one identity, layered capabilities: an annotator
// the admin designates can also validate. Requires an active qualification in
// the track. Audited as an admin grant.
export async function POST(req: Request) {
  const { user: staff } = await requireCapability("validator_ops");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { userId, trackId } = parsed.data;

  const qual = await prisma.qualification.findUnique({ where: { userId_trackId: { userId, trackId } } });
  if (!qual || qual.status !== "active") {
    return NextResponse.json({ error: "Worker needs an active qualification in that track first." }, { status: 422 });
  }

  const existing = await prisma.validatorCapability.findUnique({ where: { userId_trackId: { userId, trackId } } });
  const cap = await prisma.validatorCapability.upsert({
    where: { userId_trackId: { userId, trackId } },
    create: { userId, trackId, status: "active", lastCalibrationCheckAt: new Date() },
    update: { status: "active" },
  });
  await writeAudit({
    entityType: "ValidatorCapability",
    entityId: cap.id,
    action: existing ? "validator_reactivated_by_admin" : "validator_granted_by_admin",
    actorId: staff.id,
    after: { userId, trackId, status: "active" },
  });

  return NextResponse.json({ ok: true, id: cap.id });
}
