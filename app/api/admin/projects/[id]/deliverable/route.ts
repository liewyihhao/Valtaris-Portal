import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/portal/capabilities";
import { getProjectDeliverable } from "@/lib/portal/deliverable";

// The client-submission export: a JSON deliverable summarising accepted output
// for the project. Downloaded as an attachment.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireCapability("recruiter");
  const { id } = await ctx.params;
  const deliverable = await getProjectDeliverable(id);
  if (!deliverable) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const safe = deliverable.project.taskType.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return new NextResponse(JSON.stringify(deliverable, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="deliverable-${safe || "project"}.json"`,
    },
  });
}
