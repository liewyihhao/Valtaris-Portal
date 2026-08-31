import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { verifyPassword } from "@/lib/portal/password";
import { projectAccessCookie } from "@/lib/portal/project-credential";

const schema = z.object({ batchId: z.string().min(1), password: z.string().min(1) });

// Verify the worker's project password and unlock the project workspace for this
// session (a signed, http-only cookie scoped to that project).
export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const cred = await prisma.projectCredential.findUnique({
    where: { userId_taskBatchId: { userId: user.id, taskBatchId: parsed.data.batchId } },
  });
  if (!cred || cred.status !== "active" || !cred.passwordHash) {
    return NextResponse.json({ error: "No active project login. Set it up first." }, { status: 404 });
  }
  const ok = await verifyPassword(parsed.data.password, cred.passwordHash);
  if (!ok) return NextResponse.json({ error: "Incorrect project password." }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(`pacc_${parsed.data.batchId}`, projectAccessCookie(user.id, parsed.data.batchId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 3600, // this work session
  });
  return res;
}
