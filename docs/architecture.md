# Valtaris Portal — Architecture

This document explains the two load-bearing design boundaries in the portal, so a
future engineer understands *why* the code is shaped this way.

## 1. The self-report ↔ verified boundary

The single most important rule in the system:

> **Self-report never determines trust or pay. Only verified performance does.**

Concretely:

- Everything an annotator *claims* about themselves (language proficiency,
  domain familiarity) is stored on `QuestionnaireResponse` and is used **only**
  for routing and UX — never for tier or pay.
- The verified skill record is `Qualification.tier`. It is written in exactly one
  place: [`lib/portal/qualification.ts`](../lib/portal/qualification.ts)
  (`scoreQualificationAttempt`). The questionnaire flow, the UI, and admin CRUD
  never write it.
- Every tier write goes through an `AuditLog` row with provenance
  (`sourceAttemptId`), so a client dispute over an annotator's qualification can
  be traced to the exact test attempt that set it.

If product pressure ever pushes to "skip the test for obviously experienced
applicants," that reopens the exact gaming vector this boundary closes. Hold it.

The pay side mirrors this: `payout = base_rate × complexity × tier_multiplier`
([`lib/portal/payout.ts`](../lib/portal/payout.ts)). Nothing an annotator claims
enters that formula.

## 2. The Label Studio integration boundary

Annotators do their actual labelling in **self-hosted Label Studio Community
Edition**. Two documented CE limitations shape everything:

- **No per-project access control** — any account on an instance can see every
  project on it.
- **No task assignment / reviewer / review workflow.**

Therefore **this app is the access-control and trust layer; Label Studio is only
the task-execution engine.** We never rely on Label Studio to enforce
who-sees-what or who-does-what.

What that means in code:

| Concern | Where it lives |
|---|---|
| Who is a qualified annotator | `Qualification` (this app) |
| Which track/client → which LS instance+project | `LabelStudioMapping` |
| Per-annotator LS provisioning record | `LabelStudioAccount` |
| Access gating (invite links) | Issued only after a server-side tier check; surfaced in `/admin/label-studio` |
| Submissions → pay | Webhook `POST /api/webhooks/label-studio` → `Payout(pending_qa)` |
| QA / consensus / gold check | Built here (`lib/portal/jobs.ts`), **not** in Label Studio |
| Missed-webhook safety net | `reconcileFromLabelStudio()` (polls the LS Annotations API) |

Isolation boundary is the **instance**, not an in-app permission: deployments are
segmented by trust tier / client rather than one shared instance holding every
project. Signup on each instance is disabled
(`LABEL_STUDIO_DISABLE_SIGNUP_WITHOUT_LINK`); access is only ever granted by an
invite link this app generates after the qualification check passes.

### Provisioning is deliberately not a faked API call

CE does not document a public user-creation REST endpoint. We do **not** silently
call an assumed API. `LabelStudioAccount.provisioningStatus` tracks a
manual/semi-automated step (documented invite-link flow or the `label-studio`
CLI). See the README follow-up item — verify against the exact deployed version.

## Payout state machine

```
pending_qa ──auto QA passes──▶ approved ──payout run──▶ paid
pending_qa ──fails, reason_code──▶ rejected
pending_qa ──past max hold (72h)──▶ held (escalated to human review)
approved/paid ──confirmed fraud only──▶ clawed_back
```

- Transitions are guarded by `validateTransition()`
  ([`lib/portal/payout.ts`](../lib/portal/payout.ts)).
- `rejected` and `clawed_back` **require** a specific reason code (a closed
  enum), never a free-text "inaccurate work".
- `clawed_back` is reserved for `confirmed_fraud`; ordinary QA misses are a
  coaching signal, not a retroactive pay cut.
- Every `rejected`/`clawed_back` is appealable; upholding an appeal is an
  auditable administrative override, not a normal transition.

## Zones & route protection

Four route groups under `app/`:

- `(marketing)` — public site (Navbar/Footer). Home, how-it-works, legal.
- `(auth)` — `/login`, `/signup`.
- `(portal)` — applicant funnel (`/apply/*`) + annotator zone (`/dashboard`,
  `/earnings`, `/payment-details`, `/appeals`, `/profile`).
- `(ops)` — `/admin/*`, gated to `ops`/`admin`.

Protection is enforced **server-side twice**: in `middleware.ts` (edge JWT check)
and again in each protected layout/page via `requireUser()` / `requireStaff()`.
Zone D is never merely hidden in the UI.
