import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How the Valtaris annotator programme works — apply, get screened, qualify, and get paid for labelling data to train AI.",
};

const steps = [
  {
    n: "1",
    t: "Apply",
    d: "Create an account in under a minute — email, country, and the languages you work in. No CV required; what matters is how you perform on real task samples.",
  },
  {
    n: "2",
    t: "Screen",
    d: "A short questionnaire routes you to the right qualification track based on the domains and languages you know. A few objective calibration questions are mixed in.",
  },
  {
    n: "3",
    t: "Qualify",
    d: "Take a golden-task qualification test for your track. Your score — not anything you claim about yourself — sets your skill tier and pay band.",
  },
  {
    n: "4",
    t: "Get paid",
    d: "Sign your contractor agreement and tax form, then start pulling paid task batches. Every payout has a visible status, a clear reason for any hold, and an appeal path.",
  },
];

const pay = [
  ["Piece-rate, tiered", "You're paid per task: base rate × task complexity × your tier multiplier (T1 = 1.0×, T2 = 1.25×, T3 = 1.5×). Higher accuracy unlocks higher-paying work."],
  ["A published floor", "Every task type has a documented minimum rate, reviewed against local cost of living — never a race to the bottom."],
  ["Transparent holds", "Work goes through a quality check with a published maximum hold window (72 hours for automated checks). Nothing sits in limbo indefinitely."],
  ["Payout rails", "Payoneer is the primary rail (150+ countries), with Wise or bank transfer as fallbacks. Fees are shown before you confirm."],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="For annotators"
        title="How the Valtaris annotator programme works"
        description="Real paid work labelling data to train AI. Here's the whole path from applying to getting paid — no surprises, no hidden steps."
      >
        <Link href="/signup" className="btn-primary">
          Apply now
        </Link>
      </PageHeader>

      <section className="container-page pb-20">
        <div className="grid gap-5 sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-16 text-2xl font-semibold text-ink">How pay works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {pay.map(([t, d]) => (
            <div key={t} className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-semibold text-ink">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-line bg-surface-2 p-8 text-center">
          <h2 className="text-xl font-semibold text-ink">Ready to start?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
            Read the full{" "}
            <Link href="/legal/terms" className="text-accent underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-accent underline">
              Privacy Policy
            </Link>
            , then create your account.
          </p>
          <Link href="/signup" className="btn-primary mt-6 inline-flex">
            Apply now
          </Link>
        </div>
      </section>
    </>
  );
}
