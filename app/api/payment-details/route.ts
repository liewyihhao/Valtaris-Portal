import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { getScreeningProvider } from "@/lib/portal/screening";
import { writeAudit } from "@/lib/portal/audit";

const schema = z.object({
  provider: z.enum(["payoneer", "wise", "bank_transfer"]),
  accountRef: z.string().min(3),
  currency: z.string().min(3).max(3),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { provider, accountRef, currency } = parsed.data;

  // No payout method until tax paperwork is complete.
  const taxDone = await prisma.agreement.findFirst({
    where: { userId: user.id, type: { in: ["tax_w9", "tax_w8ben"] } },
  });
  if (!taxDone) {
    return NextResponse.json({ error: "Complete your tax paperwork before adding a payout method." }, { status: 400 });
  }

  // Sanctions/denied-party screening before activation (never hardcoded pass).
  const screening = await getScreeningProvider().screen({ fullName: user.fullName, country: user.country });
  if (!screening.cleared) {
    return NextResponse.json({ error: `Payout blocked by screening: ${screening.matchDetail}` }, { status: 403 });
  }

  const existingActive = await prisma.payoutMethod.findFirst({ where: { userId: user.id, isActive: true } });
  const isChange = !!existingActive;

  // Mask the stored reference (never keep a full account secret).
  const masked = accountRef.length > 4 ? `••••${accountRef.slice(-4)}` : accountRef;

  // Deactivate previous methods.
  await prisma.payoutMethod.updateMany({ where: { userId: user.id }, data: { isActive: false } });

  const method = await prisma.payoutMethod.create({
    data: {
      userId: user.id,
      provider,
      accountRef: masked,
      currency: currency.toUpperCase(),
      isActive: true,
      sanctionsCleared: true,
      verifiedAt: new Date(),
      // Changing an existing method triggers a short re-verification hold
      // (account-takeover-to-redirect-payout guard).
      reverifyingUntil: isChange ? new Date(Date.now() + 2 * 60 * 1000) : null,
    },
  });

  await writeAudit({
    entityType: "PayoutMethod",
    entityId: method.id,
    action: isChange ? "payout_method_changed" : "payout_method_added",
    actorId: user.id,
    after: { provider, currency: method.currency, reverifying: isChange },
  });

  return NextResponse.json({ ok: true, reverifying: isChange });
}
