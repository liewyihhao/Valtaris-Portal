import { prisma } from "@/lib/db";
import { Card } from "@/components/portal/ui/Card";
import { Badge } from "@/components/portal/ui/Badge";
import { DOMAIN_LABEL } from "@/lib/portal/constants";

export default async function QuestionsPage() {
  const questions = await prisma.calibrationQuestion.findMany({
    include: { track: true },
    orderBy: [{ trackId: "asc" }],
  });

  const byTrack: Record<string, typeof questions> = {};
  for (const q of questions) (byTrack[q.track.name] ??= []).push(q);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-p-primary">Calibration &amp; gold-task banks</h1>
      <p className="mt-1 text-sm text-p-secondary">
        Per-domain question banks. A subset is randomized per applicant so answers can&apos;t be shared.
      </p>

      <div className="mt-6 space-y-6">
        {Object.entries(byTrack).map(([trackName, qs]) => (
          <div key={trackName}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-p-secondary">{trackName}</h2>
            <div className="space-y-2">
              {qs.map((q) => {
                const options = (q.options as string[]) ?? [];
                return (
                  <Card key={q.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-p-primary">{q.prompt}</p>
                      <Badge intent={q.correctIndex === null ? "neutral" : "info"} icon={false}>
                        {q.correctIndex === null ? "Rubric" : "Auto-graded"}
                      </Badge>
                    </div>
                    {options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {options.map((o, i) => (
                          <span key={i} className={i === q.correctIndex ? "rounded bg-success/15 px-2 py-0.5 text-xs text-success" : "rounded bg-p-surface-2 px-2 py-0.5 text-xs text-p-secondary"}>
                            {o}{i === q.correctIndex ? " ✓" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-p-disabled">{DOMAIN_LABEL[q.domain as keyof typeof DOMAIN_LABEL]}</div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
