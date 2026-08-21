import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";

// Mark a lesson complete. Formative only — never grants tier (only the
// certification exam does). See master design §2.2.
export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const user = await requireUser();
  const { lessonId } = await ctx.params;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: { userId: user.id, lessonId, status: "complete", completedAt: new Date() },
    update: { status: "complete", completedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
