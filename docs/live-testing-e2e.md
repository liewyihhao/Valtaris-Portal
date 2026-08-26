# Valtaris — end-to-end live testing (Website + Portal + Studio)

How to run all three systems together and test the full journey:

```
Website (apply) ──► Portal (intake → funnel → certify → pay → support)
                        │  ▲                         │
                   SSO  │  │ standing / work-summary  │ webhook (per-annotation → pay)
                        ▼  │                          ▼
                     Studio (task execution) ─────────┘
                        ▲  set-active revocation (Portal → Studio)
```

Three repos, three servers, three ports:

| System | Repo | Local path | Dev port |
|---|---|---|---|
| Marketing site + recruitment | `Valtaris-Website` | `C:\Users\User\Valtaris Website` | **:3000** |
| HR Portal (system of record) | `Valtaris-Portal` | `C:\Users\User\Valtaris-Portal-preview` | **:3011** |
| Studio (Label Studio fork) | `Valtaris-Studio` | `C:\Users\User\Valtaris Studio` | **:8091** |

Companion docs: Website `docs/live-testing.md` (recruitment slice) + `docs/portal-integration.md`; Studio `label_studio/valtaris_sso/` runbook + `.env.valtaris.example`; Portal `docs/label-studio-bridge-design.md`.

---

## 0. One-time setup — align the shared secrets

Every cross-system secret must match. The **dev defaults already line up** across
the three repos; the only value you must generate is the service-account key.

| Secret | Portal `.env` | Website env | Studio `.env` | Purpose |
|---|---|---|---|---|
| `PORTAL_INGEST_TOKEN` | ✔ `dev-website-ingest-token` | ✔ same | — | Website → Portal application ingest (Bearer). |
| `STUDIO_SSO_SECRET` | ✔ `dev-studio-sso-…` | — | ✔ same | SSO token + set-active push (`X-Valtaris-Secret`). |
| `LABEL_STUDIO_WEBHOOK_SECRET` | ✔ `dev-label-studio-webhook-secret` | — | ✔ same | Per-annotation webhook (`X-Valtaris-Webhook-Secret`). |
| Service-account key (`vlt_…`) | created in UI | — | ✔ `VALTARIS_SERVICE_ACCOUNT_KEY` | Studio → Portal standing/work-summary (Bearer). |

**Create the bridge service key** (once): log into the Portal as
`admin@valtaris.ai` / `password123`, open **/admin/integrations**, create an
account named exactly `label_studio` with scopes `worksummary:write` +
`standing:read`, and copy the `vlt_…` key (shown once) into the Studio instance
`.env` as `VALTARIS_SERVICE_ACCOUNT_KEY`.

---

## 1. Start the three servers

```bash
# Portal (:3011) — system of record
cd "C:/Users/User/Valtaris-Portal-preview"
npm install && npm run db:push && npm run db:seed && npm run dev -- -p 3011

# Website (:3000) — pointed at the Portal ingest
cd "C:/Users/User/Valtaris Website"
# PowerShell: $env:PORTAL_APPLICATION_ENDPOINT="http://localhost:3011/api/ingest/applications"; $env:PORTAL_INGEST_TOKEN="dev-website-ingest-token"; npm run dev
PORTAL_APPLICATION_ENDPOINT="http://localhost:3011/api/ingest/applications" \
PORTAL_INGEST_TOKEN="dev-website-ingest-token" \
npm run dev            # http://localhost:3000

# Studio (:8091) — copy .env.valtaris.example into the instance .env first
cd "C:/Users/User/Valtaris Studio" && .venv/Scripts/activate
label-studio start -p 8091
```

Demo accounts (Portal, password `password123`): `admin@valtaris.ai`,
`t2.text@example.com` (T2 annotator + validator + earnings), `recruiter@` /
`finance@` / `founder@valtaris.ai`, `applicant@example.com`.

---

## 2. Test A — Website application → Portal intake

1. Website `/opportunities` → pick a position → **Apply** (or `/apply`).
2. Complete the wizard (name + email, languages, essay ≥ ~30 words, résumé
   PDF ≤ 6 MB, consent) → **Submit** → "Application Received".
3. **Verify (Portal):** log in as `recruiter@valtaris.ai` → **/admin/applications**
   shows the applicant (name, position, country, languages, status `NEW`).

Scripted check (no browser):
```bash
curl -X POST http://localhost:3011/api/ingest/applications \
  -H "Content-Type: application/json" -H "Authorization: Bearer dev-website-ingest-token" \
  -d '{"fullName":"Test User","email":"t@example.com","country":"Malaysia","consentDataProcessing":true,"languages":[{"languageName":"Malay","isStrongest":true}]}'
# → 201 { "id": "...", "status": "NEW" }   (401 without the Bearer token)
```

## 3. Test B — Portal funnel → SSO into Studio

1. Portal: take an applicant through eligibility → questionnaire → exam
   (**passing sets tier + issues a certificate**) → guidelines → agreements →
   approved. (Or use the seeded T2 annotator `t2.text@example.com`.)
2. From the annotator's Portal home, open **Studio** → `/api/studio/sso` mints a
   short-lived token → Studio logs the SSO-only user in.
3. **Verify:** the worker lands in Studio authenticated; the Portal is the only
   place they set identity/tier.

## 4. Test C — Studio annotation → Portal payout (the pay channel)

1. In Studio, submit an annotation on a task whose `meta` carries
   `valtaris_user_id`, `item_count`, `is_gold:false`.
2. Studio fires `ANNOTATION_CREATED` → `POST /api/webhooks/label-studio`
   (`X-Valtaris-Webhook-Secret`).
3. **Verify (Portal):** a `pending_qa` payout appears → run the QA job
   (`POST /api/jobs/run` with `X-Job-Secret: dev-job-runner-secret`) → it
   auto-approves or routes to a validator; the annotator sees it under
   **/earnings**. Gold tasks route to qualification, not pay.

## 5. Test D — Studio aggregation → Portal work-summary → My Work

1. Run the Studio nightly aggregation job (see the Studio runbook) — it POSTs
   `POST /api/integration/work-summary` (Bearer service key) with rows tagged
   `sourceSystem: "label_studio"`.
2. **Verify (Portal):** the annotator's **/my-work** shows the rows with a
   `label_studio` source badge. (These are a reporting mirror — never a second
   pay source; the webhook ledger is authoritative.)

Scripted check:
```bash
curl -X POST http://localhost:3011/api/integration/work-summary \
  -H "Authorization: Bearer <vlt_service_key>" -H "Content-Type: application/json" \
  -d '{"summaries":[{"userId":"<portalUserId>","periodStart":"2026-08-15T00:00:00Z","periodEnd":"2026-08-22T00:00:00Z","taskType":"Image bbox","unitsCompleted":300,"unitsApproved":290,"unitsRejected":10,"avgQualityScore":0.95}]}'
```

## 6. Test E — Portal adverse action → Studio revocation

1. Portal (Trust & Safety, log in as `admin@`): on a `fraud_suspected` flag in
   the **/admin** review queue, click **Confirm fraud → clawback** with a detail.
2. This claws back the payout (reason-coded, appealable), pauses the validator
   capability, and pushes `set-active(false)` to Studio.
3. **Verify:** the worker's `LabelStudioAccount` is `blocked`; the Studio side
   ends their session / stops serving tasks. (Sanctions re-flag via
   `reScreenSanctions` and manual suspend on **/admin/talent/[id]** do the same.)

## 7. Test F — standing gate (task-serve enforcement)

1. In the Studio `.env`, set `VALTARIS_ENFORCE_STANDING_GATE=true` (after the
   service key is set and projects are tagged) and restart Studio.
2. **Verify:** Studio calls `GET /api/integration/standing?userId=` before
   serving a task; a `paused`/`suspended` worker is denied. Failure mode is
   `closed` by default (deny when standing can't be determined).

---

## Troubleshooting

- **Webhook to localhost blocked**: Label Studio blocks SSRF to loopback by
  default — keep `SSRF_PROTECTION_ENABLED=false` in dev so `:3011` receives
  webhooks.
- **`prisma generate` EPERM (Portal)**: the running dev server locks the
  query-engine DLL — stop `:3011` before `generate`/`db push`, then restart.
- **Port in use**: Portal `:3011`, Studio `:8091` (8080 is blocked on this
  machine), Website `:3000`.
- **Ingest 401 / 500**: token mismatch (401) or `PORTAL_INGEST_TOKEN` unset on
  the Portal (500) — both sides must set the same value.
- **Reset Portal data**: `npm run db:push && npm run db:seed` (idempotent seed;
  issues certificates + demo intake cohort).

> Secrets here are **dev defaults**. For any shared/staging environment, set real
> secrets identically across the three, and mint a fresh service-account key on
> the Portal instance the Studio actually calls.
