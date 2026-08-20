import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/session";
import { prisma } from "@/lib/db";

// No trackId given → send the applicant to their primary routed track's guidelines.
export default async function GuidelinesIndex() {
  const user = await requireUser();
  const questionnaire = await prisma.questionnaireResponse.findUnique({ where: { userId: user.id } });
  const routed = (questionnaire?.routedTracks as Record<string, string> | undefined) ?? {};
  const primaryDomain = Object.keys(routed)[0];
  if (primaryDomain) {
    const track = await prisma.track.findFirst({ where: { domain: primaryDomain as never, isActive: true } });
    if (track) redirect(`/apply/guidelines/${track.id}`);
  }
  redirect("/apply");
}
