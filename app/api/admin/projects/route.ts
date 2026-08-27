import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/portal/capabilities";
import { writeAudit } from "@/lib/portal/audit";
import { provisionStudioProject } from "@/lib/portal/project-provision";

const schema = z.object({
  taskType: z.string().min(2).max(80),
  trackId: z.string().min(1),
  clientName: z.string().min(1).max(80),
  complexityMultiplier: z.number().min(0.1).max(10).default(1.0),
  estimatedItems: z.number().int().min(0).max(100_000_000).default(0),
});

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "client";
}

// Create a project (TaskBatch) + find-or-create its client. Recruiter/PM owns
// project setup and staffing. Rate cards remain a separate finance concern.
export async function POST(req: Request) {
  const { user } = await requireCapability("recruiter");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { taskType, trackId, clientName, complexityMultiplier, estimatedItems } = parsed.data;

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return NextResponse.json({ error: "Unknown track." }, { status: 422 });

  const client = await prisma.client.upsert({
    where: { key: slug(clientName) },
    create: { key: slug(clientName), name: clientName },
    update: {},
  });

  const project = await prisma.taskBatch.create({
    data: {
      trackId,
      clientId: client.id,
      clientName: client.name,
      taskType,
      complexityMultiplier,
      estimatedItems,
      isActive: true,
    },
  });

  await writeAudit({
    entityType: "TaskBatch",
    entityId: project.id,
    action: "project_created",
    actorId: user.id,
    after: { taskType, trackId, clientName: client.name, estimatedItems },
  });

  // Best-effort: spin up the Label Studio counterpart + webhook. No-ops when LS
  // isn't configured (the project is still created; ops can provision later).
  const provision = await provisionStudioProject(project.id, user.id);

  return NextResponse.json({
    ok: true,
    id: project.id,
    provisioned: provision.ok,
    studioProjectId: provision.ok ? provision.projectId : null,
    provisionNote: provision.ok ? null : provision.error,
  });
}
