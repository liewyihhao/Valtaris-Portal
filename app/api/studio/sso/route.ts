import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/portal/session";
import { studioEligible, mintStudioToken, studioLoginUrl } from "@/lib/portal/studio-access";
import { writeAudit } from "@/lib/portal/audit";

// "Start labelling" entrypoint. Server-side eligibility gate → mint a short-lived
// SSO token → redirect into Valtaris Studio already logged in. Ineligible users
// (e.g. failed exam) never get a token and are sent back with a reason.
export async function GET(req: Request) {
  const user = await requireUser();
  const { eligible, reasons } = await studioEligible(user.id);

  if (!eligible) {
    await writeAudit({
      entityType: "LabelStudioAccount",
      entityId: user.id,
      action: "studio_sso_denied",
      actorId: user.id,
      after: { reasons },
    });
    const url = new URL("/dashboard", req.url);
    url.searchParams.set("studio", "blocked");
    url.searchParams.set("reason", reasons[0] ?? "ineligible");
    return NextResponse.redirect(url);
  }

  // Optional per-project deep-link. Studio only grants access to projects that
  // have data uploaded from the Portal, so we never send a worker into an empty
  // project — redirect back with a reason instead.
  const projectBatchId = new URL(req.url).searchParams.get("project");
  let lsProjectId: string | null = null;
  if (projectBatchId) {
    const batch = await prisma.taskBatch.findUnique({ where: { id: projectBatchId }, select: { labelStudioProjectId: true, importedItems: true } });
    if (!batch?.labelStudioProjectId || batch.importedItems <= 0) {
      const url = new URL(`/projects/${projectBatchId}`, req.url);
      url.searchParams.set("studio", "no_data");
      return NextResponse.redirect(url);
    }
    lsProjectId = batch.labelStudioProjectId;
  }

  const account = await prisma.labelStudioAccount.findUnique({ where: { userId: user.id } });
  const token = mintStudioToken({ userId: user.id, email: user.email, lsUserId: account?.labelStudioUserId });

  await prisma.labelStudioAccount.updateMany({
    where: { userId: user.id },
    data: { lastSsoAt: new Date(), ssoLinkedAt: account?.ssoLinkedAt ?? new Date(), studioAccessStatus: "active", lsUserActive: true },
  });
  await writeAudit({ entityType: "LabelStudioAccount", entityId: account?.id ?? user.id, action: "studio_sso_issued", actorId: user.id, after: lsProjectId ? { project: lsProjectId } : undefined });

  return NextResponse.redirect(studioLoginUrl(token, lsProjectId));
}
