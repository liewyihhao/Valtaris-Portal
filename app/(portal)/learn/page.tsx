import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { LessonItem } from "@/components/portal/LessonItem";
import { DOMAIN_LABEL } from "@/lib/portal/constants";

export default async function LearnPage() {
  const user = await requireUser();

  // Basics (mandatory, platform-wide) + courses for domains the user selected /
  // qualified in. Non-gating: completing a course never sets tier.
  const questionnaire = await prisma.questionnaireResponse.findUnique({ where: { userId: user.id } });
  const domains = ((questionnaire?.answers as { domains?: string[] } | undefined)?.domains) ?? [];
  const trackDomains = await prisma.track.findMany({ where: { domain: { in: domains } }, select: { id: true } });
  const trackIds = trackDomains.map((t) => t.id);

  const courses = await prisma.trainingCourse.findMany({
    where: { isPublished: true, OR: [{ trackId: null }, { trackId: { in: trackIds } }] },
    include: { lessons: { orderBy: { order: "asc" } }, track: true },
    orderBy: [{ trackId: "asc" }],
  });
  const progress = await prisma.lessonProgress.findMany({ where: { userId: user.id }, select: { lessonId: true, status: true } });
  const doneSet = new Set(progress.filter((p) => p.status === "complete").map((p) => p.lessonId));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Learning Center</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Short lessons to prepare you for the certification exam. Training is coaching — only the exam sets your tier.
      </p>

      <div className="mt-4">
        <Alert tone="info" title="Recommended, not required">
          Confident? You can go straight to the exam. If your calibration score was low, we strongly suggest the track
          course first — it measurably improves pass rates and reduces rejected work later.
        </Alert>
      </div>

      <div className="mt-6 space-y-5">
        {courses.length === 0 && <p className="text-sm text-p-secondary">No courses available yet.</p>}
        {courses.map((c) => {
          const done = c.lessons.filter((l) => doneSet.has(l.id)).length;
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-p-primary">{c.title}</h2>
                    {c.isMandatory && <Badge intent="warning" icon={false}>Mandatory</Badge>}
                    {c.track && <Badge intent="neutral" icon={false}>{DOMAIN_LABEL[c.track.domain as keyof typeof DOMAIN_LABEL]}</Badge>}
                  </div>
                  {c.description && <p className="mt-1 text-sm text-p-secondary">{c.description}</p>}
                </div>
                <Badge intent={done === c.lessons.length && c.lessons.length > 0 ? "success" : "info"}>{done}/{c.lessons.length} lessons</Badge>
              </div>
              <div className="mt-4 space-y-2">
                {c.lessons.map((l) => (
                  <LessonItem
                    key={l.id}
                    lesson={{
                      id: l.id, title: l.title, content: l.content,
                      hasKnowledgeCheck: l.hasKnowledgeCheck,
                      checkPrompt: l.checkPrompt, checkOptions: (l.checkOptions as string[] | null) ?? null, checkCorrect: l.checkCorrect,
                      done: doneSet.has(l.id),
                    }}
                  />
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
