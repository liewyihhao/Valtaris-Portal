# Valtaris — Label Studio Bridge Design (Phase 5)

**Status:** design pass (no bridge code yet). **Prepared:** 2026-08-22.
**Role:** the "own design pass" the master system design (§7, §8 Phase 5) says
the bridge needs before it is built. It is deliberately scoped to the
*integration* — it does **not** redesign the HR Portal (Phases 1–4, done) or the
task-execution engine (Label Studio, other repos). It ties together the
boundary surfaces already built on the Portal side and names precisely what
remains to build, where, and in which order.

> **One-line summary.** The Portal is the system of record for *people* (identity,
> tier, validator standing, trust, payout eligibility). Label Studio is the
> system of record for *tasks* (assignments, label data, per-task QA). The bridge
> is the thin, well-defined layer that lets each read the other's truths without
> either owning the other's data.

---

## 1. What already exists — the bridge's foundation

Portal-side surfaces are built and proven; the one Studio-side surface
(`set-active`) exists in the Studio fork's `valtaris_sso` app, but the Portal
does not yet *call* it (see §3.4 — that emit is Phase-5 work).

| Surface | File / route | Direction | Auth | Built? |
|---|---|---|---|---|
| **Federated login (SSO)** | `POST /api/studio/sso` (Portal) | Portal → Studio | short-lived HS256 token (`STUDIO_SSO_SECRET`) | ✅ Portal + Studio |
| **Standing read** | `GET /api/integration/standing?userId=` (Portal) | Studio → Portal | service-account key `standing:read` | ✅ Portal |
| **Work-summary write** | `POST /api/integration/work-summary` (Portal) | Studio → Portal | service-account key `worksummary:write` | ✅ Portal |
| **Per-annotation ingest** | `POST /api/webhooks/label-studio` (Portal) | Studio → Portal | `X-Valtaris-Webhook-Secret` | ✅ Portal |
| **Reconciliation poll** | `reconcileFromLabelStudio()` in `lib/portal/jobs.ts` (+ `label-studio-client.ts`) | Portal → Studio | LS API token | ✅ Portal (no-ops when unconfigured) |
| **Service-account admin** | `/admin/integrations` (Portal) | — | `executive` | ✅ Portal |
| **Access revocation** | `set-active` in the Studio fork's `valtaris_sso` app | Portal → Studio | shared secret | ⚠️ Studio endpoint exists; **Portal-side caller not yet wired** |

Standing read, work-summary write, per-annotation ingest, and their auth are
proven end-to-end (Phase 4). Two independent Studio→Portal channels coexist, and
their relationship is the crux of this design (§4):

Two independent Studio→Portal channels already coexist, and their relationship
is the crux of this design (§4):

1. **Per-annotation webhook** → drives **pay** (each unit of work becomes a payout
   line that flows through the QA/validator/appeal state machine).
2. **Work-summary API** → drives **reporting** (aggregate "how am I doing" on
   `/my-work`, cohort/analytics rollups, capacity forecasting).

---

## 2. Boundary of ownership (who is source of truth for what)

| Concern | Source of truth | The other side… |
|---|---|---|
| Identity, account status | **Portal** (`User.status`) | Studio mirrors it (via SSO + set-active); never invents accounts. |
| Tier per track, validator capability | **Portal** (`Qualification`, `ValidatorCapability`) | Studio reads via `standing`; uses it to gate task assignment. |
| Trust / fraud / sanctions status | **Portal** (`TrustProfile`, `reviewFlag`) | Studio reads standing; a paused worker is deactivated in Studio. |
| Payout eligibility + state | **Portal** (`Payout` state machine) | Studio never computes pay; it emits work events. |
| Task assignment, label data | **Studio** | Portal never stores label content. |
| Per-task raw QA signal (gold, consensus) | **Studio** | Portal ingests a *derived* verdict, not the raw data. |
| Aggregate work output (volume, approval rate) | **Studio** (once bridged) | Portal stores the summary (`WorkSummary`), not the tasks. |

**Load-bearing rule inherited from the Portal:** *self-report never sets trust or
pay; only verified performance does.* The bridge must not let a task-engine
number silently move tier or pay. Tier is written in exactly one place
(`lib/portal/qualification.ts`); the bridge feeds evidence *into* that service
(gold-task results), it does not write tier itself.

---

## 3. Data flows (the four crossings)

### 3.1 Onboarding → provisioning (Portal → Studio)
```
Applicant completes funnel → promoted to annotator (Portal)
  → Portal creates a pending LabelStudioAccount
  → Bridge provisions the Studio-side user (SSO-only), sets initial project
    membership from standing (tier/track)
  → Worker clicks "Open Studio" → /api/studio/sso mints a token → logged in
```
Already 90% built (SSO + pending account). Phase-5 work: the Studio-side
connector that consumes standing to set **project/queue membership** (which task
pools a worker may pull from, by track + tier).

### 3.2 Live work → pay (Studio → Portal)
```
Annotation submitted in Studio
  → webhook POST /api/webhooks/label-studio (per annotation)
  → Portal creates pending_qa Payout → QA job → (auto-approve | route to
    validator | reject) → approved → batch payout run → paid
  → gold-task submissions route to QualificationTestAttempt instead of pay
```
Fully built on the Portal side. Phase-5 work: configure Studio webhooks + ensure
every task carries `meta.valtaris_user_id` and `meta.item_count`.

### 3.3 Aggregate reporting (Studio → Portal)
```
Studio periodically (e.g. nightly) aggregates each worker's completed/approved/
rejected units + avg quality per task type per period
  → POST /api/integration/work-summary (idempotent upsert, sourceSystem="label_studio")
  → surfaces on /my-work and feeds cohort/forecast analytics
```
Portal side built + proven against internal data. Phase-5 work: the Studio-side
aggregation job that produces and posts these rows.

### 3.4 Standing change → access (Portal → Studio)
```
Tier drop below T2 / fraud clawback / sanctions flag / account suspend (Portal)
  → Portal already: pauses validator capability, freezes payouts, reason-codes it
  → Bridge: POST set-active(false) to Studio (or narrows project membership)
  → Studio stops routing new tasks to that worker
```
Trigger points exist (`syncValidatorWithTier`, `pauseValidatorOnFraud`,
`reScreenSanctions`). Phase-5 work: emit the set-active/membership call from those
points (today they only update Portal state + notify).

---

## 4. The reconciliation problem (the hard part — master design §7)

Two Studio→Portal channels describe the *same underlying work* at different
grains. If both are treated as pay-affecting truth, work is **double-counted**;
if their QA verdicts disagree, the worker sees **contradictions**. Design
decision:

- **Webhook per-annotation is the pay channel and the QA authority for pay.**
  Each annotation → one payout line → the existing QA/validator/appeal machine.
  This is the *only* channel that moves money.
- **Work-summary is a reporting mirror, never a second pay source.** Its
  `unitsApproved`/`avgQualityScore` are display + analytics. It must reconcile
  *to* the payout ledger, not compete with it.
- **Reconciliation rule:** for a given `(worker, period, taskType)`, the
  authoritative approved-unit count is derived from `Payout` rows (status in
  `approved|paid`), not from the summary. The bridge's Studio-side aggregator
  should compute summaries from the *same events* it webhooks, so the two agree
  by construction. A nightly Portal-side check compares
  `sum(WorkSummary.unitsApproved where sourceSystem=label_studio)` against the
  payout-derived count per worker/period and raises an ops flag on drift beyond a
  tolerance — surfacing missed webhooks (already partially covered by
  `reconcileFromLabelStudio`) or aggregation bugs rather than silently trusting
  either number.
- **No QA-verdict override.** The Portal's validator decisions are final for pay.
  A Studio-side "consensus score" in a `WorkSummary` never flips a `Payout`
  status; at most it is a signal that routes *future* work to sampling.

This keeps the invariant intact: **one ledger moves money; everything else is a
view of it.**

---

## 5. Identity mapping

- Portal `User.id` (cuid) is the canonical worker id across the bridge.
- Studio users are SSO-only; the SSO token carries the Portal `User.id`, so the
  Studio account is keyed to it at first login (`LabelStudioAccount`).
- Every task in Studio must stamp `meta.valtaris_user_id = <User.id>` so the
  webhook and the aggregator both attribute work to the right person.
- **No PII crosses for matching.** The bridge never joins on email/name; only the
  opaque `User.id`. The `standing` and verification endpoints return display
  fields only, never contact details.

---

## 6. Auth model (three tokens, three trust levels)

| Token | Used by | Scope | Rotation |
|---|---|---|---|
| **Service-account API key** (`vlt_…`) | Studio → Portal (`/api/integration/*`) | per-scope (`standing:read`, `worksummary:write`) | revoke + re-issue at `/admin/integrations`; sha256 at rest. |
| **Webhook secret** (`X-Valtaris-Webhook-Secret`) | Studio → Portal (`/api/webhooks/label-studio`) | ingest only | env-rotated; verify constant-time. |
| **SSO token** (HS256, short-lived) | Portal → Studio (`/api/studio/sso`) | single login | minted per click; expiry ~minutes. |

Phase-5 addition worth deciding now: give the bridge its **own** service account
(name `label_studio`, both scopes) rather than reusing a human's session — which
is exactly what the Phase-4 model enables. Consider per-environment keys
(staging vs prod) and a key-rotation runbook.

---

## 7. Failure modes & idempotency

| Failure | Handling |
|---|---|
| Duplicate webhook delivery | Idempotent per annotation id (existing). |
| Missed webhook | `reconcileFromLabelStudio()` poll re-ingests; nightly drift check (§4) flags gaps. |
| Duplicate work-summary push | Idempotent upsert on `(userId,periodStart,periodEnd,taskType,sourceSystem)` (built). |
| Unknown `userId` in a push | `422` with the offending ids; nothing written (built). |
| Studio unreachable for set-active | Retry with backoff; Portal state is already correct, so the worst case is a lag in Studio deactivation — mitigate by having Studio *also* re-check standing before assigning a task (belt-and-suspenders). |
| Key compromised | Revoke at `/admin/integrations` → immediate 401 (built). |

---

## 8. Phase-5 build order (bridge only; still no Portal rebuild)

1. **Studio-side connector skeleton** — read `standing` before task assignment;
   respect `accountStatus` + tier/track. (Consumes built endpoint.)
2. **Provisioning + membership** — on Portal promotion, set Studio project
   membership from standing; wire set-active into the four adverse triggers (§3.4).
3. **Webhook wiring** — configure Studio webhooks; guarantee task `meta`
   (`valtaris_user_id`, `item_count`, `is_gold`).
4. **Aggregation job** — Studio nightly job posts `work-summary` rows computed
   from the same events it webhooks (so §4 reconciles by construction).
5. **Reconciliation monitor** — Portal nightly drift check (payout-ledger vs
   summary) → ops flag; extend `reconcileFromLabelStudio`.
6. **Runbook** — key rotation, webhook-secret rotation, incident response for
   drift/pay disputes.

## 9. Explicit non-goals (unchanged from master design §9)

No webhook *redesign*, no task-assignment sync engine, no QA-verdict
reconciliation that lets Studio override Portal pay decisions, no label-data
storage in the Portal. Those are either out of scope entirely or handled by the
"reporting mirror, never a second pay source" rule above.

---

*Companion to `architecture.md`, `api.md`, and the master system design. Grounded
in the Phase-4 surfaces in `lib/portal/service-account.ts`,
`lib/portal/standing.ts`, `app/api/integration/*`, `app/api/webhooks/label-studio`,
and `app/api/studio/sso`.*
