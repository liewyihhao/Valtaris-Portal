"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/portal/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/portal/ui/Field";
import { Button } from "@/components/portal/ui/Button";
import { Stepper } from "@/components/portal/ui/Stepper";
import { Alert } from "@/components/portal/ui/Alert";
import { LANGUAGES, PROFICIENCIES, SELF_RATINGS } from "@/lib/portal/options";
import { DOMAIN_LABEL } from "@/lib/portal/constants";
import { cn } from "@/lib/utils";

type Question = { id: string; domain: string; prompt: string; options: string[] };
type Pool = Record<string, Question[]>;
type Answer = { questionId: string; selectedIndex?: number; freeText?: string };

const STEPS = [
  { key: "A", label: "A · Languages" },
  { key: "B", label: "B · Domains" },
  { key: "C", label: "C · Quick check" },
  { key: "D", label: "D · Setup" },
  { key: "E", label: "E · Availability" },
  { key: "F", label: "F · Background" },
];

const STORAGE_KEY = "valtaris-questionnaire-draft";

export function QuestionnaireForm({ domains, calibrationPool }: { domains: string[]; calibrationPool: Pool }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [langs, setLangs] = useState<Record<string, { proficiency: string }>>({});
  const [primaryLang, setPrimaryLang] = useState<string>("");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selfRatings, setSelfRatings] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [connection, setConnection] = useState("Yes");
  const [hours, setHours] = useState("10");
  const [surge, setSurge] = useState("Yes");
  const [priorPlatforms, setPriorPlatforms] = useState("");
  const [certifications, setCertifications] = useState("");

  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const device = typeof navigator !== "undefined" && /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop";

  // Restore/persist draft locally so a refresh never loses progress.
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const d = JSON.parse(raw);
        setLangs(d.langs ?? {});
        setPrimaryLang(d.primaryLang ?? "");
        setSelectedDomains(d.selectedDomains ?? []);
        setSelfRatings(d.selfRatings ?? {});
        setAnswers(d.answers ?? {});
        setConnection(d.connection ?? "Yes");
        setHours(d.hours ?? "10");
        setSurge(d.surge ?? "Yes");
        setPriorPlatforms(d.priorPlatforms ?? "");
        setCertifications(d.certifications ?? "");
      } catch {}
    }
  }, []);

  useEffect(() => {
    const d = { langs, primaryLang, selectedDomains, selfRatings, answers, connection, hours, surge, priorPlatforms, certifications };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }, [langs, primaryLang, selectedDomains, selfRatings, answers, connection, hours, surge, priorPlatforms, certifications]);

  function toggleLang(l: string) {
    setLangs((prev) => {
      const next = { ...prev };
      if (next[l]) delete next[l];
      else next[l] = { proficiency: "Professional fluency" };
      return next;
    });
  }

  function toggleDomain(d: string) {
    setSelectedDomains((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  function setAnswer(domain: string, questionId: string, patch: Partial<Answer>) {
    setAnswers((prev) => {
      const list = prev[domain] ? [...prev[domain]] : [];
      const idx = list.findIndex((a) => a.questionId === questionId);
      if (idx === -1) list.push({ questionId, ...patch });
      else list[idx] = { ...list[idx], ...patch };
      return { ...prev, [domain]: list };
    });
  }

  function next() {
    setError(null);
    if (step === 0 && Object.keys(langs).length === 0) return setError("Select at least one language.");
    if (step === 1 && selectedDomains.length === 0) return setError("Select at least one domain.");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const payload = {
      languages: Object.entries(langs).map(([code, v]) => ({
        code,
        proficiency: v.proficiency,
        primary: code === primaryLang,
      })),
      domains: selectedDomains,
      selfRatings: Object.fromEntries(selectedDomains.map((d) => [d, selfRatings[d] ?? "None"])),
      calibrationAnswers: Object.fromEntries(selectedDomains.map((d) => [d, answers[d] ?? []])),
      technical: { device, connection },
      availability: { hours: Number(hours), timezone, surge: surge === "Yes" },
      priorPlatforms,
      certifications,
    };
    const res = await fetch("/api/apply/questionnaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Could not submit. Please check your answers and try again.");
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    router.push("/apply");
    router.refresh();
  }

  return (
    <div>
      <Stepper steps={STEPS} currentKey={STEPS[step].key} />
      <Card className="mt-5">
        {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}

        {/* A — Languages */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-p-primary">Languages you can make nuanced judgments in</h2>
            <p className="mb-4 mt-1 text-sm text-p-secondary">Not just get by — fluent enough for edge-case calls.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {LANGUAGES.map((l) => (
                <label key={l} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", langs[l] ? "border-p-accent bg-p-accent-subtle" : "border-p-border")}>
                  <span className="flex items-center gap-2 text-p-primary">
                    <input type="checkbox" checked={!!langs[l]} onChange={() => toggleLang(l)} className="h-4 w-4 accent-[#5b8def]" />
                    {l}
                  </span>
                  {langs[l] && (
                    <select
                      value={langs[l].proficiency}
                      onChange={(e) => setLangs((p) => ({ ...p, [l]: { proficiency: e.target.value } }))}
                      className="rounded border border-p-border bg-p-surface-2 px-2 py-1 text-xs text-p-primary"
                    >
                      {PROFICIENCIES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  )}
                </label>
              ))}
            </div>
            {Object.keys(langs).length > 0 && (
              <Field label="Which is your primary day-to-day language?" htmlFor="primary" >
                <Select id="primary" value={primaryLang} onChange={(e) => setPrimaryLang(e.target.value)}>
                  <option value="">Select…</option>
                  {Object.keys(langs).map((l) => <option key={l}>{l}</option>)}
                </Select>
              </Field>
            )}
          </div>
        )}

        {/* B — Domains */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-p-primary">Which kinds of work interest you?</h2>
            <p className="mb-4 mt-1 text-sm text-p-secondary">Pick any that apply. Your familiarity rating here only affects routing.</p>
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d} className={cn("rounded-lg border px-3 py-2.5", selectedDomains.includes(d) ? "border-p-accent bg-p-accent-subtle" : "border-p-border")}>
                  <label className="flex items-center gap-2 text-sm font-medium text-p-primary">
                    <input type="checkbox" checked={selectedDomains.includes(d)} onChange={() => toggleDomain(d)} className="h-4 w-4 accent-[#5b8def]" />
                    {DOMAIN_LABEL[d as keyof typeof DOMAIN_LABEL] ?? d}
                  </label>
                  {selectedDomains.includes(d) && (
                    <div className="mt-2 pl-6">
                      <span className="mr-2 text-xs text-p-secondary">Familiarity:</span>
                      <select
                        value={selfRatings[d] ?? "None"}
                        onChange={(e) => setSelfRatings((p) => ({ ...p, [d]: e.target.value }))}
                        className="rounded border border-p-border bg-p-surface-2 px-2 py-1 text-xs text-p-primary"
                      >
                        {SELF_RATINGS.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* C — Calibration */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-p-primary">A few quick judgment questions</h2>
              <p className="mt-1 text-sm text-p-secondary">Answer as best you can — there&apos;s no penalty for guessing.</p>
            </div>
            {selectedDomains.map((d) => (
              <div key={d}>
                <div className="mb-2 text-sm font-semibold text-p-accent">{DOMAIN_LABEL[d as keyof typeof DOMAIN_LABEL] ?? d}</div>
                {(calibrationPool[d] ?? []).length === 0 && (
                  <p className="text-sm text-p-secondary">No calibration items configured for this domain yet.</p>
                )}
                {(calibrationPool[d] ?? []).map((q) => {
                  const current = (answers[d] ?? []).find((a) => a.questionId === q.id);
                  const opts = (q.options as string[]) ?? [];
                  return (
                    <div key={q.id} className="mb-4 rounded-lg border border-p-border p-4">
                      <p className="mb-3 text-sm text-p-primary">{q.prompt}</p>
                      {opts.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {opts.map((o, i) => (
                            <label key={i} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", current?.selectedIndex === i ? "border-p-accent bg-p-accent-subtle text-p-accent" : "border-p-border text-p-primary")}>
                              <input type="radio" name={q.id} checked={current?.selectedIndex === i} onChange={() => setAnswer(d, q.id, { selectedIndex: i })} className="h-4 w-4 accent-[#5b8def]" />
                              {o}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <Textarea placeholder="Your answer…" value={current?.freeText ?? ""} onChange={(e) => setAnswer(d, q.id, { freeText: e.target.value })} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* D — Technical */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-p-primary">Your setup</h2>
            <p className="mb-4 mt-1 text-sm text-p-secondary">Detected device: <b className="text-p-primary">{device}</b> · Timezone: <b className="text-p-primary">{timezone}</b></p>
            <Field label="Do you have a stable internet connection for multi-hour sessions?">
              <Select value={connection} onChange={(e) => setConnection(e.target.value)}>
                <option>Yes</option><option>Sometimes</option><option>No</option>
              </Select>
            </Field>
          </div>
        )}

        {/* E — Availability */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-p-primary">Availability</h2>
            <Field label="Roughly how many hours per week can you commit?">
              <Input type="number" min={1} max={80} value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
            <Field label="Open to short-notice surge work (48-hour turnarounds)?">
              <Select value={surge} onChange={(e) => setSurge(e.target.value)}>
                <option>Yes</option><option>No</option>
              </Select>
            </Field>
          </div>
        )}

        {/* F — Background */}
        {step === 5 && (
          <div>
            <h2 className="text-lg font-semibold text-p-primary">Background (optional)</h2>
            <Field label="Prior annotation platforms" hint="(optional)">
              <Textarea value={priorPlatforms} onChange={(e) => setPriorPlatforms(e.target.value)} placeholder="e.g. worked on X for 6 months" />
            </Field>
            <Field label="Relevant certifications or credentials" hint="(optional — verified manually before any sensitive-data track)">
              <Textarea value={certifications} onChange={(e) => setCertifications(e.target.value)} placeholder="e.g. registered nurse, law degree" />
            </Field>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={back} disabled={step === 0}>← Back</Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={next}>Next →</Button>
          ) : (
            <Button size="sm" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit questionnaire"}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
