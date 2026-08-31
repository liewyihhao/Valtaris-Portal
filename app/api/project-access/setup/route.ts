import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { completeProjectCredential } from "@/lib/portal/project-credential";

const schema = z.object({
  credId: z.string().min(1),
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Worker completes their project login setup (verify emailed token + set the
// project password). Must be signed in as the credential's owner.
export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const cred = await prisma.projectCredential.findUnique({ where: { id: parsed.data.credId } });
  if (!cred || cred.userId !== user.id) {
    return NextResponse.json({ error: "Project login not found." }, { status: 404 });
  }

  const result = await completeProjectCredential(parsed.data.credId, parsed.data.token, parsed.data.password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, username: result.username, taskBatchId: cred.taskBatchId });
}
