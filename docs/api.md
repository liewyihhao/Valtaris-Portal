# Valtaris Portal — API Reference

REST-style Route Handlers under `app/api/`. All mutating routes require an
authenticated session unless noted; `/admin/*` requires `ops`/`admin`.

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

## Admin (ops/admin only)

| Method | Path | Body | Effect |
|---|---|---|---|
| PATCH | `/api/admin/appeals/[id]` | `{ decision:"upheld"\|"denied", note }` | Resolves an appeal; `upheld` restores the payout to `approved` (audited override). |
| PATCH | `/api/admin/flags/[id]` | `{ action:"resolve"\|"dismiss", note? }` | Closes a review flag. |

## Integration & jobs

| Method | Path | Auth | Effect |
|---|---|---|---|
| POST | `/api/webhooks/label-studio` | `X-Valtaris-Webhook-Secret` header | Idempotent ingest of `ANNOTATION_CREATED/UPDATED` → creates `pending_qa` payout + enqueues a QA job. Gold items route to qualification, not pay. |
| POST | `/api/jobs/run` | `X-Job-Secret` header | Cron entrypoint: processes queued QA jobs, escalates expired holds, runs reconciliation. |

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
