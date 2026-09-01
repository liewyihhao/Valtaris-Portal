import { createReadStream } from "node:fs";
import { prisma } from "@/lib/db";
import { labelStudio } from "./label-studio-client";
import { parseDataset, type DatasetFormat } from "./dataset-parse";
import { writeAudit } from "./audit";

// ---------------------------------------------------------------------------
// DATASET IMPORT — stream a stored upload into the project's Studio project as
// tasks, in batches, updating progress. Resumable (skips rows already imported,
// by source_row_id = row index) and safe for multi-GB files (never buffers the
// whole file). The webhook then carries source_row_id + valtaris_project back.
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500; // tasks per Studio import call (sequential = backpressure)

/** Run (or resume) the import for one DatasetUpload. Never throws. */
export async function runDatasetImport(uploadId: string): Promise<{ ok: boolean; imported: number; error?: string }> {
  const upload = await prisma.datasetUpload.findUnique({ where: { id: uploadId }, include: { taskBatch: true } });
  if (!upload) return { ok: false, imported: 0, error: "Upload not found." };
  const batch = upload.taskBatch;
  if (!batch.labelStudioProjectId) {
    await prisma.datasetUpload.update({ where: { id: uploadId }, data: { status: "failed", lastError: "Project is not provisioned to Studio yet." } });
    return { ok: false, imported: upload.importedRows, error: "Project not provisioned." };
  }

  await prisma.datasetUpload.update({ where: { id: uploadId }, data: { status: "importing", lastError: null } });
  const resumeFrom = upload.importedRows; // rows [0, resumeFrom) are already imported
  let imported = resumeFrom;
  let pending: Array<Record<string, unknown>> = [];

  async function flush(nextImported: number) {
    if (pending.length === 0) return;
    const res = await labelStudio.importTasks(batch.labelStudioProjectId!, pending);
    if (res.configured && !res.ok) throw new Error(res.error ?? `Studio import failed (HTTP ${res.status}).`);
    const delta = pending.length;
    pending = [];
    imported = nextImported;
    await prisma.$transaction([
      prisma.datasetUpload.update({ where: { id: uploadId }, data: { importedRows: imported } }),
      prisma.taskBatch.update({ where: { id: batch.id }, data: { importedItems: { increment: delta } } }),
    ]);
  }

  try {
    const stream = createReadStream(upload.storagePath, { encoding: "utf8" });
    let lastIndex = resumeFrom - 1;
    for await (const row of parseDataset(upload.format as DatasetFormat, stream)) {
      if (row.index < resumeFrom) continue; // already imported on a prior run
      pending.push({
        data: row.data,
        meta: { valtaris_project: batch.id, source_row_id: String(row.index), is_gold: false },
      });
      lastIndex = row.index;
      if (pending.length >= BATCH_SIZE) await flush(lastIndex + 1);
    }
    await flush(lastIndex + 1);

    await prisma.datasetUpload.update({ where: { id: uploadId }, data: { status: "completed" } });
    await writeAudit({ entityType: "DatasetUpload", entityId: uploadId, action: "dataset_imported", after: { importedRows: imported, taskBatchId: batch.id } });
    return { ok: true, imported };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.datasetUpload.update({ where: { id: uploadId }, data: { status: "failed", lastError: error.slice(0, 500) } });
    return { ok: false, imported, error };
  }
}
