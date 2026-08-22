import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/portal/capabilities";
import { createServiceAccount, sanitizeScopes, SERVICE_SCOPES } from "@/lib/portal/service-account";

const schema = z.object({
  name: z.string().min(2).max(64).regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits, and underscores."),
  description: z.string().max(200).optional(),
  scopes: z.array(z.string()).min(1, "Select at least one scope."),
});

// Create a service account. Returns the RAW key ONCE — it is never retrievable
// again. Executive/admin-scoped (integrations are high-privilege).
export async function POST(req: Request) {
  const { user } = await requireCapability("executive");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const scopes = sanitizeScopes(parsed.data.scopes);
  if (scopes.length === 0) {
    return NextResponse.json({ error: `No valid scopes. Allowed: ${SERVICE_SCOPES.join(", ")}` }, { status: 400 });
  }
  try {
    const { account, rawKey } = await createServiceAccount({
      name: parsed.data.name,
      description: parsed.data.description,
      scopes,
      createdById: user.id,
    });
    return NextResponse.json({ ok: true, id: account.id, name: account.name, scopes: account.scopes, rawKey });
  } catch {
    return NextResponse.json({ error: "A service account with that name already exists." }, { status: 409 });
  }
}
