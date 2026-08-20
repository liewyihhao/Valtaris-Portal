import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { furthestStage } from "@/lib/portal/funnel";
import { writeAudit } from "@/lib/portal/audit";
import { AGREEMENT_DOCS } from "@/lib/portal/agreements-content";

const schema = z.object({
  signatureName: z.string().min(2),
  taxFormType: z.enum(["tax_w9", "tax_w8ben"]),
  taxData: z.object({
    legalName: z.string().min(2),
    taxId: z.string().min(1), // masked/placeholder in demo — never a real SSN store
    countryOfResidence: z.string().min(1),
  }),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "All agreements and tax fields are required." }, { status: 400 });
  }
  const { signatureName, taxFormType, taxData } = parsed.data;

  // Record the three agreements (each with an immutable snapshot) + tax form.
  const now = new Date();
  const docs: { type: "contractor" | "nda" | "tos"; snapshot: string }[] = [
    { type: "contractor", snapshot: AGREEMENT_DOCS.contractor.body },
    { type: "nda", snapshot: AGREEMENT_DOCS.nda.body },
    { type: "tos", snapshot: AGREEMENT_DOCS.tos.body },
  ];

  await prisma.$transaction([
    ...docs.map((d) =>
      prisma.agreement.upsert({
        where: { userId_type: { userId: user.id, type: d.type } },
        create: { userId: user.id, type: d.type, signatureName, documentSnapshot: d.snapshot, signedAt: now },
        update: { signatureName, documentSnapshot: d.snapshot, signedAt: now },
      })
    ),
    prisma.agreement.upsert({
      where: { userId_type: { userId: user.id, type: taxFormType } },
      create: {
        userId: user.id,
        type: taxFormType,
        signatureName,
        documentSnapshot: `${taxFormType.toUpperCase()} submitted`,
        signedAt: now,
        // NOTE: taxId is stored as provided in this demo. A real deployment must
        // encrypt/tokenize this and never keep a raw SSN.
        taxData: { ...taxData, taxId: `••••${taxData.taxId.slice(-4)}` },
      },
      update: { signatureName, signedAt: now, taxData: { ...taxData, taxId: `••••${taxData.taxId.slice(-4)}` } },
    }),
    // Promote to a working annotator + create the (pending) Label Studio account.
    prisma.user.update({
      where: { id: user.id },
      data: {
        role: "annotator",
        fullName: taxData.legalName,
        applicationStage: furthestStage(user.applicationStage, "approved"),
      },
    }),
    prisma.labelStudioAccount.upsert({
      where: { userId: user.id },
      create: { userId: user.id, provisioningStatus: "pending" },
      update: {},
    }),
  ]);

  await writeAudit({
    entityType: "User",
    entityId: user.id,
    action: "approved_annotator",
    actorId: user.id,
    after: { role: "annotator", stage: "approved" },
  });

  return NextResponse.json({ ok: true });
}
