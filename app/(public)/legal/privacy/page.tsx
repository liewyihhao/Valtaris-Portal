import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description="How Valtaris handles your personal data as an applicant and annotator."
      />
      <section className="container-page pb-24">
        <div className="mb-8 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">
          ⚠ PLACEHOLDER — replace with reviewed legal text before launch.
        </div>
        <div className="max-w-prose space-y-5 text-sm leading-relaxed text-ink-muted">
          <p><strong className="text-ink">Data we collect.</strong> Account details (email, country, language), questionnaire answers, qualification results, payout method references (masked), and tax documentation.</p>
          <p><strong className="text-ink">Why we process it.</strong> To screen and qualify you, route you to appropriate work, pay you, and meet legal/tax obligations. Recruitment data and any personal data encountered inside labelling tasks are handled separately.</p>
          <p><strong className="text-ink">Your rights.</strong> Under GDPR and equivalent laws you may request access, correction, or deletion of your personal data, subject to records we must retain for tax and dispute purposes.</p>
          <p><strong className="text-ink">Retention.</strong> Payout and qualification records are retained for audit and dispute resolution. Payout account secrets are never stored in full.</p>
        </div>
      </section>
    </>
  );
}
