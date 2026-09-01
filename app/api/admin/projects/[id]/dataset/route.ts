import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { detectFormat } from "@/lib/portal/dataset-parse";
import { runDatasetImport } from "@/lib/portal/dataset-import";

export const runtime = "nodejs";

// Upload a customer dataset file for a project. The file is streamed straight to
// private disk (never buffered) so multi-GB uploads work, a DatasetUpload record
// is created, and the import into Studio is kicked off in the background.
// The client sends the file as the raw request body: POST ...?filename=data.jsonl
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await requireCapability("recruiter");
  const { id } = await ctx.params;

  const project = await prisma.taskBatch.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const filename = new URL(req.url).searchParams.get("filename") ?? "";
  const format = detectFormat(filename);
  if (!format) {
    return NextResponse.json({ error: "Unsupported file — use .jsonl / .ndjson, .csv, or .json." }, { status: 415 });
  }
  if (!req.body) return NextResponse.json({ error: "No file body." }, { status: 400 });

  const dir = path.join(process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private-uploads"), "datasets");
  await mkdir(dir, { recursive: true });
  const safe = filename.replace(/[^a-z0-9._-]/gi, "_");
  const storagePath = path.join(dir, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safe}`);

  try {
    await pipeline(Readable.fromWeb(req.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(storagePath));
  } catch (e) {
    return NextResponse.json({ error: `Upload failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  const upload = await prisma.datasetUpload.create({
    data: { taskBatchId: id, filename, format, storagePath, status: "uploaded", uploadedById: user.id },
  });

  // Import in the background — the request returns immediately; status is polled.
  void runDatasetImport(upload.id);

  return NextResponse.json({ ok: true, uploadId: upload.id, format });
}
