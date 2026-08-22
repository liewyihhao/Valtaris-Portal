import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/portal/capabilities";
import { saveTrackForecast } from "@/lib/portal/forecast";

const schema = z.object({
  trackId: z.string().min(1),
  projectedIntake: z.number().int().min(1).max(100000),
});

// Generate + persist a capacity-forecast snapshot for a track. Recruiter-owned
// (feeds funnel targets + validator supply planning).
export async function POST(req: Request) {
  const { user } = await requireCapability("recruiter");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const forecast = await saveTrackForecast({ ...parsed.data, generatedById: user.id });
  return NextResponse.json({ ok: true, forecast });
}
