import { requireUser } from "@/lib/portal/session";
import { PortalNav } from "@/components/portal/PortalNav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const approved = user.role === "annotator" || user.applicationStage === "approved";

  return (
    <div className="portal-root flex min-h-screen flex-col md:flex-row">
      <PortalNav role={user.role} email={user.email} approved={approved} />
      <main id="main" className="flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
