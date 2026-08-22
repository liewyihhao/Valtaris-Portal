import { NextResponse } from "next/server";
import { authenticateServiceAccount } from "@/lib/portal/service-account";
import { getWorkerStanding } from "@/lib/portal/standing";

// GET /api/integration/standing?userId=... — the bridge's read boundary.
// Service-account auth (scope standing:read), never a user session.
export async function GET(req: Request) {
  const auth = await authenticateServiceAccount(req, "standing:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId query parameter is required." }, { status: 400 });

  const standing = await getWorkerStanding(userId);
  if (!standing) return NextResponse.json({ error: "Worker not found." }, { status: 404 });

  return NextResponse.json(standing);
}
