import { verifyCertificate } from "@/lib/portal/certificate";
import { TIER_LABEL, type Tier } from "@/lib/portal/constants";

const REASON_LABEL: Record<string, string> = {
  valid: "This is a valid, active Valtaris certification.",
  revoked: "This certificate has been revoked.",
  no_qualification: "The underlying qualification no longer exists.",
  tier_changed: "The holder's current tier differs from this certificate — it is superseded.",
  "qualification_suspended": "The holder's qualification is currently suspended.",
  "qualification_revoked": "The holder's qualification has been revoked.",
};

export default async function VerifyCertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const result = await verifyCertificate(serial);

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-p-secondary">Valtaris · Certificate verification</p>
      <h1 className="mt-2 text-2xl font-semibold text-p-primary">Credential check</h1>

      {!result.found ? (
        <div className="mt-6 rounded-xl border border-p-border bg-p-surface-2 p-5">
          <div className="text-lg font-semibold text-p-primary">Not found</div>
          <p className="mt-1 text-sm text-p-secondary">
            No certificate matches serial <span className="font-mono">{serial}</span>. Check for typos, or ask the holder to re-share their verification link.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-p-border bg-p-surface-2 p-5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                result.valid ? "bg-success/12 text-success border border-success/30" : "bg-warning/12 text-warning border border-warning/30"
              }`}
            >
              {result.valid ? "Valid" : "Not currently valid"}
            </span>
            <span className="font-mono text-xs text-p-secondary">{result.serial}</span>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-p-secondary">Holder</dt><dd className="text-p-primary">{result.holderName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-p-secondary">Track</dt><dd className="text-p-primary">{result.trackName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-p-secondary">Tier</dt><dd className="text-p-primary">{TIER_LABEL[result.tier as Tier] ?? result.tier}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-p-secondary">Issued</dt><dd className="text-p-primary">{result.issuedAt.toLocaleDateString()}</dd></div>
          </dl>

          <p className="mt-4 text-xs text-p-secondary">{REASON_LABEL[result.reason] ?? result.reason}</p>
        </div>
      )}
    </main>
  );
}
