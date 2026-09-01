import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ingestAnnotation } from "@/lib/portal/ingest";

// A validator's review is submitted in Studio as an annotation too, so this
// webhook also fires for reviews. If the annotation carries a review_decision,
// it is a review (handled by the explicit C3 endpoint) — NOT a pay annotation.
// Treating it as one would create a spurious payout (double-pay).
function carriesReviewDecision(annotation: { review_decision?: unknown; result?: unknown }): boolean {
  if (annotation?.review_decision != null) return true;
  const result = annotation?.result;
  if (Array.isArray(result)) {
    return result.some((r) => {
      const item = r as { from_name?: string; to_name?: string; type?: string; value?: Record<string, unknown> };
      return (
        item?.from_name === "review_decision" ||
        item?.to_name === "review_decision" ||
        item?.type === "review_decision" ||
        (item?.value != null && typeof item.value === "object" && "review_decision" in item.value)
      );
    });
  }
  return false;
}

// Webhook receiver for ANNOTATION_CREATED / ANNOTATION_UPDATED. Verifies a
// shared secret — never accepts unauthenticated payloads that can create
// payout records. Idempotent via WebhookEvent unique constraint.
export async function POST(req: Request) {
  const secret = req.headers.get("x-valtaris-webhook-secret");
  if (!secret || secret !== process.env.LABEL_STUDIO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  // Label Studio sends { action, annotation, task, project }. Be defensive
  // about the exact shape — store the raw payload regardless.
  const action: string = body.action ?? "ANNOTATION_CREATED";
  const annotation = body.annotation ?? {};
  const task = body.task ?? {};
  const projectId = String(body.project ?? task.project ?? "");
  const annotationId = String(annotation.id ?? "");
  const taskId = String(task.id ?? "");
  const meta = task.meta ?? task.data ?? {};
  // Gold is identified natively: the task carries a ground_truth answer key
  // (Section 9). We accept the answer key inline (from LS's ground_truth
  // annotation) or fall back to a legacy is_gold metadata flag.
  const groundTruthResult = body.ground_truth_result ?? task.ground_truth_result ?? meta.ground_truth_result ?? null;
  const isGold = groundTruthResult != null || Boolean(meta.is_gold) || Boolean(annotation.ground_truth);
  const isQualification = Boolean(body.is_qualification ?? meta.is_qualification);

  // Idempotency: skip if we've already recorded this annotation+event.
  const existing = await prisma.webhookEvent.findFirst({
    where: { source: "label_studio", labelStudioAnnotationId: annotationId, eventType: action },
  });
  if (existing?.processed) return NextResponse.json({ ok: true, deduped: true });

  await prisma.webhookEvent.upsert({
    where: {
      source_labelStudioAnnotationId_eventType: {
        source: "label_studio",
        labelStudioAnnotationId: annotationId,
        eventType: action,
      },
    },
    create: {
      source: "label_studio",
      eventType: action,
      labelStudioAnnotationId: annotationId,
      labelStudioTaskId: taskId,
      labelStudioProjectId: projectId,
      rawPayload: body,
    },
    update: { rawPayload: body },
  });

  // A review-annotation is not a pay annotation — reviews come through the C3
  // /api/integration/review endpoint. Record the event but skip the pay path so
  // the validator/annotator is never double-paid.
  if (carriesReviewDecision(annotation)) {
    await prisma.webhookEvent.updateMany({
      where: { labelStudioAnnotationId: annotationId, eventType: action },
      data: { processed: true },
    });
    return NextResponse.json({ ok: true, skipped: "review_decision" });
  }

  const result = await ingestAnnotation({
    labelStudioProjectId: projectId,
    labelStudioTaskId: taskId,
    labelStudioAnnotationId: annotationId,
    labelStudioUserId: annotation.completed_by ? String(annotation.completed_by) : null,
    valtarisUserId: meta.valtaris_user_id ?? null,
    isGold,
    isQualification,
    submittedResult: annotation.result ?? null,
    groundTruthResult,
    itemCount: meta.item_count ?? 1,
  });

  await prisma.webhookEvent.updateMany({
    where: { labelStudioAnnotationId: annotationId, eventType: action },
    data: { processed: true },
  });

  return NextResponse.json({ ok: true, result });
}
