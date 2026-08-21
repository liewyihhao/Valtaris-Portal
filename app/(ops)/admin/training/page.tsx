import { requireCapability } from "@/lib/portal/capabilities";
import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { Alert } from "@/components/portal/ui/Alert";
import { DOMAIN_LABEL } from "@/lib/portal/constants";

export default async function TrainingContentPage() {
  await requireCapability("training_author");
  const courses = await prisma.trainingCourse.findMany({
    include: { lessons: { orderBy: { order: "asc" } }, track: true, _count: { select: { lessons: true } } },
    orderBy: [{ trackId: "asc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Training content</h1>
      <p className="mt-1 text-sm text-p-secondary">Learning Center courses. Content is versioned and kept aligned with the exam rationale.</p>

      <div className="mt-4">
        <Alert tone="info" title="Non-gating by design">
          Course completion and knowledge-checks are formative — they never grant tier. Only the certification exam does.
        </Alert>
      </div>

      <div className="mt-6 space-y-4">
        {courses.length === 0 && <p className="text-sm text-p-secondary">No courses yet.</p>}
        {courses.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-p-primary">{c.title}</span>
                <Badge intent="neutral" icon={false}>v{c.version}</Badge>
                {c.isMandatory && <Badge intent="warning" icon={false}>Mandatory</Badge>}
                {c.track ? <Badge intent="info" icon={false}>{DOMAIN_LABEL[c.track.domain as keyof typeof DOMAIN_LABEL]}</Badge> : <Badge intent="info" icon={false}>Platform-wide</Badge>}
                {!c.isPublished && <Badge intent="danger" icon={false}>Draft</Badge>}
              </div>
              <span className="text-sm text-p-secondary">{c._count.lessons} lessons</span>
            </div>
            <ol className="mt-3 space-y-1 text-sm text-p-secondary">
              {c.lessons.map((l) => (
                <li key={l.id}>{l.order}. {l.title}{l.hasKnowledgeCheck ? " · knowledge-check" : ""}</li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
