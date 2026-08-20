import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description="The agreement governing your use of the Valtaris annotator platform."
      />
      <section className="container-page pb-24">
        <div className="mb-8 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">
          ⚠ PLACEHOLDER — replace with reviewed legal text before launch. The text
          below is a non-binding outline only.
        </div>
        <div className="prose-invert max-w-prose space-y-5 text-sm leading-relaxed text-ink-muted">
          <p><strong className="text-ink">1. Independent contractor status.</strong> Annotators are independent contractors, not employees. You choose which task batches to accept and when to work. AI-assisted answers on qualification and paid tasks are prohibited.</p>
          <p><strong className="text-ink">2. Qualification &amp; tiers.</strong> Skill tier is set solely by qualification-test performance and governs which tasks and pay bands you can access. Self-reported experience never sets tier or pay.</p>
          <p><strong className="text-ink">3. Payment.</strong> Pay is piece-rate (base rate × complexity × tier multiplier), subject to a published quality-check hold window. Every reduction or rejection carries a specific reason code and is appealable.</p>
          <p><strong className="text-ink">4. Data confidentiality.</strong> You may see client data under an NDA and data-handling agreement. You must not copy, retain, or disclose it.</p>
          <p><strong className="text-ink">5. Account &amp; conduct.</strong> One account per person. Multi-accounting, automation, and cheating are grounds for review and, where confirmed, deactivation — itself a separate, appealable action from a single task rejection.</p>
          <p><strong className="text-ink">6. Taxes.</strong> You are responsible for your own taxes. Valid W-9/W-8BEN documentation is required before payout is enabled.</p>
        </div>
      </section>
    </>
  );
}
