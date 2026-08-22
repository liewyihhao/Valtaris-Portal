# Valtaris Portal — API Reference

REST-style Route Handlers under `app/api/`. All mutating routes require an
authenticated session unless noted. `/api/admin/*` routes are **capability-scoped**
via `requireCapability(...)` (defense-in-depth to match the capability-scoped
OpsNav); the legacy `ops`/`admin`/`pm` roles map onto capability sets for
backward compatibility (`lib/portal/capabilities.ts`). System-to-system routes
under `/api/integration/*` use **service-account API keys**, never a user session
(see *Integration boundary* below).

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/[...nextauth]` | — | NextAuth (Auth.js v5) credentials handler. |
| POST | `/api/signup` | `{ email, password, country, primaryLanguage, consent }` | Creates an `applicant`. Returns `{ verifyUrl }` (dev email stand-in). |
| GET | `/api/verify?email=&token=` | — | Verifies email via stateless HMAC token → redirects to `/login?verified=1`. |

## Applicant funnel

| Method | Path | Body | Effect |
|---|---|---|---|
| POST | `/api/apply/eligibility` | `{ ageConfirmed, region, deviceType }` | Runs eligibility gate; on pass advances stage → `questionnaire`. |
| POST | `/api/apply/questionnaire` | `{ languages, domains, selfRatings, calibrationAnswers, technical, availability, priorPlatforms, certifications }` | Grades calibration server-side, routes each domain, flags mismatches, advances → `qualification_test`. |
| POST | `/api/apply/exam/[trackId]` | `{ answers:[{questionId, selectedIndex}] }` | Grades vs DB keys, records attempt, **sets tier on pass** (only writer), advances → `guidelines`. Returns `429` during retry cooldown. |
| POST | `/api/apply/guidelines/[trackId]` | `{ guidelineVersionId }` | Records acknowledgment of that version, advances → `agreements`. |
| POST | `/api/apply/agreements` | `{ signatureName, taxFormType, taxData }` | Signs all agreements + tax form, promotes to `annotator`, creates pending `LabelStudioAccount`, advances → `approved`. |

## Annotator

| Method | Path | Body | Effect |
|---|---|---|---|
| POST | `/api/payment-details` | `{ provider, accountRef, currency }` | Screens (sanctions), masks + stores method; a change triggers a re-verification hold. Requires tax paperwork complete. |
| POST | `/api/payouts/request` | — | Pays out all `approved` payouts via the mocked rail (threshold-gated, requires verified method). |
| POST | `/api/appeals` | `{ payoutId, explanation }` | Opens an appeal (SLA = +3 business days), raises an ops flag. |

## Public verification (no auth)

| Method | Path | Auth | Effect |
|---|---|---|---|
| GET | `/api/verify/certificate/[serial]` | none | Verifies a certificate by public serial. Cross-checks the live `Qualification`, so a revoked/suspended/down-tiered credential returns `valid:false`. Returns non-sensitive fields only. `404` if the serial is unknown. Also rendered at `/verify/[serial]`. |

## Admin (capability-scoped)

Each route names the capability it requires. `admin` holds all; `ops` holds the
ops set; `pm` maps to `recruiter`.

| Method | Path | Capability | Effect |
|---|---|---|---|
| PATCH | `/api/admin/appeals/[id]` | `trust_safety` | Resolves an appeal; `upheld` restores the payout to `approved` (audited); notifies the worker. |
| PATCH | `/api/admin/flags/[id]` | `trust_safety` | `resolve`/`dismiss` a flag, or `confirm_fraud` (with `reasonDetail`, payout from flag context or `payoutId`) → claws back the payout, pauses the validator capability, revokes Studio access, notifies the worker (appealable), and resolves the flag. |
| PATCH | `/api/admin/payout-runs/[id]` | `finance_ops` | `approve`/`execute`/`cancel` a payout run; `execute` dispatches + notifies each worker once. |
| POST | `/api/admin/guidelines` | `training_author` | Publishes a new guideline version → recert "what changed" module + broadcast to certified annotators. |
| POST | `/api/admin/forecast` | `recruiter` | Generates + persists a `WorkforceForecast` (intake × pass-rate × active-rate). |
| POST | `/api/admin/service-accounts` | `executive` | Creates a service account; **returns the raw API key once**. |
| PATCH | `/api/admin/service-accounts/[id]` | `executive` | `{ action:"revoke" }` — the key stops authenticating immediately. |

## Integration & jobs

| Method | Path | Auth | Effect |
|---|---|---|---|
| POST | `/api/webhooks/label-studio` | `X-Valtaris-Webhook-Secret` header | Idempotent ingest of `ANNOTATION_CREATED/UPDATED` → creates `pending_qa` payout + enqueues a QA job. Gold items route to qualification, not pay. |
| POST | `/api/jobs/run` | `X-Job-Secret` header | Cron entrypoint: processes queued jobs (QA + broadcast notifications), escalates expired holds, **expires correction windows**, **re-screens sanctions** (quarterly cadence), reconciles Label Studio, runs dormancy warn/purge. |

## Integration boundary (service-account keys)

The read/write contract the future Label Studio bridge uses (master design §9).
Authenticate with `Authorization: Bearer <key>` (or `X-Api-Key: <key>`). Keys are
created at `/admin/integrations`, sha256-hashed at rest, and scoped. `401` for a
missing/invalid/revoked key; `403` when the key lacks the required scope.

| Method | Path | Scope | Effect |
|---|---|---|---|
| GET | `/api/integration/standing?userId=` | `standing:read` | Worker standing: tier per track, account status, validator-capability status. The API-first read boundary. |
| POST | `/api/integration/work-summary` | `worksummary:write` | Upserts `WorkSummary` rows (the inbound contract). Rows are tagged with the calling account's name as `sourceSystem`. Idempotent on `(userId, periodStart, periodEnd, taskType, sourceSystem)`. Validates all `userId`s exist (`422` otherwise). |

### Example: bridge writes a work summary

```bash
curl -X POST http://localhost:3011/api/integration/work-summary \
  -H "Authorization: Bearer vlt_<key>" \
  -H "Content-Type: application/json" \
  -d '{ "summaries": [ {
    "userId": "<USER_ID>", "periodStart": "2026-08-15T00:00:00Z",
    "periodEnd": "2026-08-22T00:00:00Z", "taskType": "Image bbox",
    "unitsCompleted": 300, "unitsApproved": 290, "unitsRejected": 10,
    "avgQualityScore": 0.95
  } ] }'
```

### Example: trigger a payout via a simulated webhook

```bash
curl -X POST http://localhost:3000/api/webhooks/label-studio \
  -H "Content-Type: application/json" \
  -H "X-Valtaris-Webhook-Secret: dev-label-studio-webhook-secret" \
  -d '{
    "action": "ANNOTATION_CREATED",
    "project": "ls-proj-101",
    "annotation": { "id": 9001, "completed_by": "ls_abc123" },
    "task": { "id": 5001, "meta": { "is_gold": false, "item_count": 100, "valtaris_user_id": "<USER_ID>" } }
  }'
```

Then process the QA job:

```bash
curl -X POST http://localhost:3000/api/jobs/run -H "X-Job-Secret: dev-job-runner-secret"
```
