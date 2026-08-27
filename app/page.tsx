import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/portal/session";

// The Portal is an internal ops + workforce tool — it has no public marketing
// face (that lives in the separate Valtaris marketing website, which feeds the
// Portal via /api/ingest/applications). The root routes each visitor to where
// they belong instead of showing a landing page.
export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isStaff(user.role)) redirect("/admin/home");
  if (user.role === "applicant") redirect("/apply");
  redirect("/dashboard");
}
