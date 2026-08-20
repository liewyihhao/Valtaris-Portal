import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ingestAnnotation } from "@/lib/portal/ingest";

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
  const isGold = Boolean(meta.is_gold);

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

  const result = await ingestAnnotation({
    labelStudioProjectId: projectId,
    labelStudioTaskId: taskId,
    labelStudioAnnotationId: annotationId,
    labelStudioUserId: annotation.completed_by ? String(annotation.completed_by) : null,
    valtarisUserId: meta.valtaris_user_id ?? null,
    isGold,
    goldCorrect: meta.gold_correct ?? null,
    itemCount: meta.item_count ?? 1,
  });

  await prisma.webhookEvent.updateMany({
    where: { labelStudioAnnotationId: annotationId, eventType: action },
    data: { processed: true },
  });

  return NextResponse.json({ ok: true, result });
}
