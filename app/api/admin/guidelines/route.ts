import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/portal/capabilities";
import { publishGuidelineVersion } from "@/lib/portal/guidelines";

const schema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(3, "A title is required."),
  content: z.string().min(1, "Guideline content is required."),
  changeSummary: z.string().min(3, "Describe what changed for the recert module."),
});

// Publish a new guideline version for a track → recert "what changed" module +
// notification to currently-certified annotators. Training/Content owns this.
export async function POST(req: Request) {
  const { user } = await requireCapability("training_author");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const result = await publishGuidelineVersion({ ...parsed.data, actorId: user.id });
  return NextResponse.json({ ok: true, ...result });
}
