import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/portal/capabilities";
import { revokeServiceAccount } from "@/lib/portal/service-account";

const schema = z.object({ action: z.literal("revoke") });

// Revoke a service account (its key stops authenticating immediately).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await requireCapability("executive");
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await revokeServiceAccount(id, user.id);
  return NextResponse.json({ ok: true });
}
