import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { runDatasetImport } from "@/lib/portal/dataset-import";

export const runtime = "nodejs";

// Retry / resume an import (picks up from importedRows). Runs in the background.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; uploadId: string }> }) {
  await requireCapability("recruiter");
  const { uploadId } = await ctx.params;
  const upload = await prisma.datasetUpload.findUnique({ where: { id: uploadId } });
  if (!upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  if (upload.status === "importing") return NextResponse.json({ error: "Import already running." }, { status: 409 });

  void runDatasetImport(uploadId);
  return NextResponse.json({ ok: true });
}
