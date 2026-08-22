import { NextResponse } from "next/server";
import {
  runQueuedJobs,
  escalateExpiredHolds,
  expireCorrectionWindows,
  reconcileFromLabelStudio,
  runDormancyWarnings,
  runDormancyPurge,
} from "@/lib/portal/jobs";

// Cron entrypoint. Protect with a shared secret so it can't be triggered by
// anyone. A scheduler (cron, GitHub Action, Vercel Cron) calls this hourly.
export async function POST(req: Request) {
  const secret = req.headers.get("x-job-secret");
  if (!secret || secret !== process.env.JOB_RUNNER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processed = await runQueuedJobs();
  const escalated = await escalateExpiredHolds();
  const correctionsExpired = await expireCorrectionWindows();
  const reconciled = await reconcileFromLabelStudio();
  const dormancyWarned = await runDormancyWarnings();
  const purged = await runDormancyPurge();

  return NextResponse.json({ ok: true, processed, escalated, correctionsExpired, reconciled, dormancyWarned, purged });
}
