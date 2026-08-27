// ---------------------------------------------------------------------------
// STUDIO PROJECT PROVISIONING.
//
// Creating a Portal project (TaskBatch) spins up its Label Studio counterpart:
// create the LS project, store its id on the TaskBatch (labelStudioProjectId),
// and register the annotation webhook back to the Portal. Best-effort and
// idempotent — no-ops safely when Label Studio isn't configured (dev without a
// token), so project creation never fails on it; ops can provision later once
// LS is reachable. Top level is prisma-free so the pure helper is testable.
// ---------------------------------------------------------------------------

import type { Domain } from "./constants";

// Minimal starter labeling configs per domain — a usable default the ops person
// refines in Studio. Not the final labeling interface, just enough to open the
// project and start importing tasks.
const LABEL_CONFIG: Record<Domain, string> = {
  text_nlp:
    '<View><Text name="text" value="$text"/><Choices name="label" toName="text"><Choice value="Positive"/><Choice value="Neutral"/><Choice value="Negative"/></Choices></View>',
  image:
    '<View><Image name="image" value="$image"/><RectangleLabels name="label" toName="image"><Label value="Object"/></RectangleLabels></View>',
  video:
    '<View><Video name="video" value="$video"/><Choices name="label" toName="video"><Choice value="Relevant"/><Choice value="Not relevant"/></Choices></View>',
  audio:
    '<View><Audio name="audio" value="$audio"/><TextArea name="transcript" toName="audio" placeholder="Transcribe…"/></View>',
  llm_eval:
    '<View><Text name="prompt" value="$prompt"/><Text name="response" value="$response"/><Rating name="quality" toName="response" maxRating="5"/></View>',
  other:
    '<View><Text name="text" value="$text"/><TextArea name="answer" toName="text" placeholder="Your answer…"/></View>',
};

/** Starter labeling config for a track's domain. Pure — unit-testable. */
export function labelConfigForDomain(domain: string): string {
  return LABEL_CONFIG[domain as Domain] ?? LABEL_CONFIG.other;
}

export type ProvisionResult =
  | { ok: true; projectId: string; alreadyProvisioned?: boolean }
  | { ok: false; configured?: boolean; error: string };

/** Provision (or reuse) the Label Studio project for a Portal project. */
export async function provisionStudioProject(taskBatchId: string, actorId?: string | null): Promise<ProvisionResult> {
  const { prisma } = await import("@/lib/db");
  const { labelStudio } = await import("./label-studio-client");
  const { writeAudit } = await import("./audit");

  const batch = await prisma.taskBatch.findUnique({ where: { id: taskBatchId }, include: { track: true } });
  if (!batch) return { ok: false, error: "Project not found." };
  if (batch.labelStudioProjectId) {
    return { ok: true, projectId: batch.labelStudioProjectId, alreadyProvisioned: true };
  }
  if (!labelStudio.configured()) {
    return { ok: false, configured: false, error: "Label Studio not configured (set LABEL_STUDIO_BASE_URL + LABEL_STUDIO_API_TOKEN)." };
  }

  const title = `${batch.clientName} — ${batch.taskType}`;
  const created = await labelStudio.createProject({ title, label_config: labelConfigForDomain(batch.track.domain) });
  const data = created.data as { id?: number | string } | undefined;
  if (!created.ok || data?.id == null) {
    return { ok: false, error: created.error ?? `Studio project creation failed (HTTP ${created.status}).` };
  }
  const lsProjectId = String(data.id);

  await prisma.taskBatch.update({ where: { id: taskBatchId }, data: { labelStudioProjectId: lsProjectId } });

  // Register the annotation webhook so this project's work flows back to pay.
  const base = process.env.PORTAL_BASE_URL ?? "http://localhost:3011";
  await labelStudio.ensureWebhook(lsProjectId, `${base}/api/webhooks/label-studio`);

  await writeAudit({
    entityType: "TaskBatch",
    entityId: taskBatchId,
    action: "studio_project_provisioned",
    actorId: actorId ?? null,
    after: { labelStudioProjectId: lsProjectId, title },
  });

  return { ok: true, projectId: lsProjectId };
}
