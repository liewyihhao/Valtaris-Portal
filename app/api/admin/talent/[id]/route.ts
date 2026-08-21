import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePM } from "@/lib/portal/session";
import { writeAudit } from "@/lib/portal/audit";
import { getKycProvider } from "@/lib/portal/kyc";
import { setStudioAccess } from "@/lib/portal/studio-access";

const schema = z.object({
  action: z.enum(["suspend", "reactivate", "request_reverification", "trigger_recert"]),
  note: z.string().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requirePM();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Annotator not found" }, { status: 404 });
  const a = parsed.data.action;

  if (a === "suspend") {
    await prisma.user.update({ where: { id }, data: { status: "suspended" } });
    // Revoke Studio access immediately.
    await setStudioAccess(id, "suspended", "suspended");
  } else if (a === "reactivate") {
    await prisma.user.update({ where: { id }, data: { status: "active", lastActiveAt: new Date() } });
    await setStudioAccess(id, "active");
  } else if (a === "request_reverification") {
    // Kick off (stubbed) KYC and flag for the ops queue. We never store raw ID data.
    const { providerRef } = await getKycProvider().startIdBiometric({ userId: id });
    await prisma.trustProfile.upsert({
      where: { userId: id },
      create: { userId: id, kycProviderRef: providerRef, kycLevel: "email_phone" },
      update: { kycProviderRef: providerRef, idVerifiedAt: null, biometricVerifiedAt: null, kycLevel: "email_phone" },
    });
    await prisma.reviewFlag.create({
      data: { userId: id, type: "identity_reverification", note: parsed.data.note ?? "Manual re-verification requested.", context: { providerRef } },
    });
  } else if (a === "trigger_recert") {
    await prisma.qualification.updateMany({ where: { userId: id, status: "active" }, data: { recertDueAt: new Date() } });
  }

  await writeAudit({
    entityType: "User",
    entityId: id,
    action: `talent_${a}`,
    actorId: staff.id,
    after: { action: a, note: parsed.data.note ?? null },
  });

  return NextResponse.json({ ok: true });
}
