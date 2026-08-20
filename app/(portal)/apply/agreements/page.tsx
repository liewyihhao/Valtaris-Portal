import { requireUser } from "@/lib/portal/session";
import { AgreementsFlow } from "@/components/portal/AgreementsFlow";
import { PlaceholderNote } from "@/components/portal/ui/Alert";

export default async function AgreementsPage() {
  const user = await requireUser();
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-p-secondary">Step 5 · Agreements</div>
      <h1 className="mt-1 text-2xl font-semibold text-p-primary">Agreements &amp; tax info</h1>
      <p className="mt-1 mb-4 text-sm text-p-secondary">
        Every legal document in one step — each shown in full and individually e-signed. Tax paperwork is
        collected here because it&apos;s required before any payout can be enabled.
      </p>
      <div className="mb-5">
        <PlaceholderNote>agreement and tax copy is placeholder — replace with reviewed legal text before launch.</PlaceholderNote>
      </div>
      <AgreementsFlow defaultCountry={user.country} />
    </div>
  );
}
