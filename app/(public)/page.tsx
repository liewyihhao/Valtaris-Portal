import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Get paid to help train AI",
  description:
    "Join the Valtaris annotator network. Apply, pass a short qualification, and get paid for real data labelling and AI evaluation work.",
};

const steps = [
  {
    step: "01",
    title: "Apply",
    body: "Create an account and tell us your languages and skills. It takes a few minutes.",
  },
  {
    step: "02",
    title: "Qualify",
    body: "Complete a short guideline review and a paid-standard qualification for your track.",
  },
  {
    step: "03",
    title: "Get paid",
    body: "Work on real projects, track your earnings, and request payouts from your dashboard.",
  },
];

export default function PortalHome() {
  return (
    <>
      <PageHeader
        eyebrow="Valtaris Annotator Network"
        title="Get paid to help train AI"
        description="Real, qualified work labelling and evaluating data for teams building AI. Apply, pass a short qualification for your track, and start earning."
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/apply" className="btn-primary">
            Apply now
          </Link>
          <Link href="/how-it-works" className="btn-secondary">
            How it works
          </Link>
        </div>
      </PageHeader>

      <section className="pb-24">
        <div className="container-page grid gap-5 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.step} className="rounded-2xl border border-line bg-surface/60 p-6">
              <span className="font-mono text-sm text-accent">{s.step}</span>
              <h2 className="mt-3 text-lg font-semibold text-ink">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
