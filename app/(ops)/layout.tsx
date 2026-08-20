import { requireStaff } from "@/lib/portal/session";
import { OpsNav } from "@/components/portal/OpsNav";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // Server-side role gate for all of Zone D (in addition to middleware).
  const user = await requireStaff();
  return (
    <div className="portal-root flex min-h-screen flex-col md:flex-row">
      <OpsNav email={user.email} />
      <main id="main" className="flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
