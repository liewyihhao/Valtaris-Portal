import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateServiceAccount } from "@/lib/portal/service-account";
import { payValidatorForReview } from "@/lib/portal/validator";
import { writeAudit } from "@/lib/portal/audit";

// Contract C3: a validator's review of an annotated item, reported from Studio.
// Attributes the review to the validator, pays them per completed review, and
// records it as the validated-count ledger. Idempotent per
// (project, sourceRowId, validator) so retries never double-pay. Reject /
// correction are reason-coded (and appealable via the annotator's payout flow).
const schema = z.object({
  validatorUserId: z.string().min(1),
  project: z.string().min(1), // taskBatchId
  sourceRowId: z.string().min(1),
  annotatorUserId: z.string().optional(),
  decision: z.enum(["approve", "reject", "correction"]),
  reasonCode: z.string().nullable().optional(),
  reasonDetail: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await authenticateServiceAccount(req, "review:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  const { validatorUserId, project, sourceRowId, annotatorUserId, decision, reasonCode, reasonDetail } = parsed.data;

  const [batch, validator] = await Promise.all([
    prisma.taskBatch.findUnique({ where: { id: project } }),
    prisma.user.findUnique({ where: { id: validatorUserId }, select: { id: true } }),
  ]);
  if (!batch) return NextResponse.json({ error: "Unknown project." }, { status: 422 });
  if (!validator) return NextResponse.json({ error: "Unknown validator." }, { status: 422 });

  // Idempotency: one review per (project, sourceRowId, validator).
  const existing = await prisma.taskReview.findUnique({
    where: { taskBatchId_sourceRowId_validatorId: { taskBatchId: project, sourceRowId, validatorId: validatorUserId } },
  });
  if (existing) return NextResponse.json({ ok: true, deduped: true, id: existing.id });

  // Pay the validator for the completed review (any decision is real review work).
  const payoutId = await payValidatorForReview(validatorUserId, batch.trackId, batch.id);

  const review = await prisma.taskReview.create({
    data: { taskBatchId: project, sourceRowId, validatorId: validatorUserId, annotatorId: annotatorUserId ?? null, decision, reasonCode: reasonCode ?? null, reasonDetail: reasonDetail ?? null, payoutId: payoutId ?? null },
  });
  await writeAudit({ entityType: "TaskReview", entityId: review.id, action: `review_${decision}`, actorId: validatorUserId, after: { project, sourceRowId, decision } });

  return NextResponse.json({ ok: true, id: review.id });
}
