import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";
import { QuestionnaireForm } from "@/components/portal/QuestionnaireForm";

// Fisher–Yates, seeded by nothing (per-request randomization) — pull a subset
// from a larger pool so answers can't be shared/memorized across applicants.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function QuestionnairePage() {
  await requireUser();

  const tracks = await prisma.track.findMany({
    where: { isActive: true },
    select: { id: true, name: true, domain: true },
    orderBy: { name: "asc" },
  });

  const questions = await prisma.calibrationQuestion.findMany({
    where: { isActive: true },
    select: { id: true, domain: true, prompt: true, options: true },
  });

  // Group by domain, shuffle, cap at 5 per domain.
  const byDomain: Record<string, typeof questions> = {};
  for (const q of questions) {
    (byDomain[q.domain] ??= []).push(q);
  }
  const pool = Object.fromEntries(
    Object.entries(byDomain).map(([d, qs]) => [d, shuffle(qs).slice(0, 5)])
  );

  // Unique domains offered (from active tracks).
  const domains = Array.from(new Set(tracks.map((t) => t.domain)));

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">Step 2 · Screening</div>
      <h1 className="mt-1 text-2xl font-semibold text-p-primary">Screening questionnaire</h1>
      <p className="mt-1 text-sm text-p-secondary">
        This routes you to the right qualification test. Your answers here never set your tier —
        only the test does. Progress is saved on this device between steps.
      </p>
      <div className="mt-6">
        <QuestionnaireForm domains={domains} calibrationPool={pool as never} />
      </div>
    </div>
  );
}
