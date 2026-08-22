CONTINUE: Valtaris — Label Studio ↔ HR Portal bridge (Studio side, Phase 5)

WHAT THIS IS
Valtaris runs a crowdsourced data-annotation marketplace with two systems:
- The **HR Portal** (people: recruit→train→certify→validate→pay→support). It is
  COMPLETE through Phase 4 + the bridge design pass. Do NOT build Portal features
  here.
- **Valtaris Studio** (a Label Studio / Django fork — the task-execution engine).
  THIS is your repo. You are building the **Studio side of the bridge** that
  connects the two, per the design pass the Portal team already wrote.

The Portal is the single source of truth for identity, tier, validator standing,
trust/fraud/sanctions status, and payout. Studio owns task assignment and label
data, and must READ the Portal's truths (never invent tier or pay). The Portal
side of every bridge contract below is already built, verified, and on
`main` — your job is the Studio-side connector that consumes/serves them.

TWO GITHUB REPOS — NEVER MIX:
- Studio (THIS work) → https://github.com/liewyihhao/Valtaris-Studio
- Portal (do NOT touch) → https://github.com/liewyihhao/Valtaris-Portal
- Also exists, unrelated: liewyihhao/Valtaris-Website (marketing site).

WHERE THINGS ARE (local)
- Studio fork clone: C:\Users\User\Valtaris Studio   (branch valtaris-rebrand;
  has a .venv with Python 3.12 + Django 5.2). The existing SSO app is at
  label_studio/valtaris_sso/ — AUDIT it first; SSO login + a set-active endpoint
  may already exist there (SSO was verified live cross-language).
- Portal clone (READ-ONLY reference — do not edit/commit): C:\Users\User\Valtaris-Portal-preview
  The authoritative design pass is docs/label-studio-bridge-design.md there.
  Also read docs/api.md (the Integration boundary section) and
  lib/portal/studio-access.ts, lib/portal/service-account.ts, lib/portal/standing.ts.
- WARNING: a stray .git exists at C:\Users\User (remote Valtaris-Studio-Web-App).
  NEVER `git add -A` from a folder lacking its own .git. Always `git -C "<folder>"`
  and verify `git -C <folder> rev-parse --show-toplevel` before staging.
- Other Claude sessions run concurrently; `git fetch` + check
  `merge-base --is-ancestor origin/main HEAD` before pushing.

ENVIRONMENT QUIRKS (this Windows machine)
- Docker Desktop does NOT reliably start — don't rely on it.
- Studio dev server runs on :8091 (port 8080 was blocked).
- Portal dev server runs on :3011 (someone may already have it up).
- LF→CRLF git warnings are harmless.

=== THE PORTAL-SIDE CONTRACTS (all built; integrate against these) ===

Shared secrets/keys must MATCH the Portal's env exactly:
- STUDIO_SSO_SECRET  — verifies the SSO token AND authenticates the set-active
  push (`X-Valtaris-Secret`). Portal .env default: "dev-studio-sso-shared-secret-change-me".
- LABEL_STUDIO_WEBHOOK_SECRET — the webhook `X-Valtaris-Webhook-Secret`. Portal
  .env default: "dev-label-studio-webhook-secret".
- A **service-account API key** — create it in the Portal UI at
  /admin/integrations (log in as admin@valtaris.ai / password123), name it
  exactly `label_studio`, scopes `worksummary:write` + `standing:read`. The raw
  key (`vlt_…`) is shown ONCE. The account NAME becomes the `sourceSystem` tag on
  every WorkSummary row you write, so name it `label_studio`.
- PORTAL_BASE_URL = http://localhost:3011 (dev).

1) FEDERATED LOGIN (Portal → Studio) — already built both sides; confirm it.
   Portal mints an HS256 token (claims { sub:<portal userId>, email, lsUserId, exp≈+120s })
   signed with STUDIO_SSO_SECRET, and links to `${LABEL_STUDIO_BASE_URL}/sso/login?token=…`.
   Studio's valtaris_sso verifies + logs in an SSO-only user.

2) ACCESS REVOCATION (Portal → Studio) — Portal now CALLS this; make Studio HONOR it.
   The Portal fires, on confirmed-fraud / sanctions-flag / manual-suspend:
     POST ${LABEL_STUDIO_BASE_URL}/api/valtaris/set-active
     Header: X-Valtaris-Secret: <STUDIO_SSO_SECRET>
     Body:   { "valtaris_user_id": "<portal userId>", "active": false }   (or true to restore)
   Studio must: verify the secret, map valtaris_user_id → the Studio user, set
   is_active accordingly, END ANY ACTIVE SESSION (so a live worker is actually
   kicked, not just blocked from re-login), and stop routing new tasks to them.
   Return 200 on success, 401 on bad secret, 404 on unknown user.

3) STANDING READ (Studio → Portal) — call before assigning/serving tasks.
     GET ${PORTAL_BASE_URL}/api/integration/standing?userId=<portal userId>
     Header: Authorization: Bearer <service-account key>   (scope standing:read)
   Returns:
     { userId, accountStatus,                       // active|dormant|suspended|purged
       qualifications:[{trackSlug,trackName,tier,status}],   // tier=T0..T3, status=active|…
       validatorCapabilities:[{trackSlug,status}] } // status=active|paused|revoked
   Use it to gate which project/task pools a worker may pull from (by track +
   tier), and to belt-and-suspenders re-check standing at assignment time even
   if a set-active push was missed. 401 missing/invalid/revoked key, 403 wrong scope.

4) WORK-SUMMARY WRITE (Studio → Portal) — the aggregate reporting contract.
   A nightly Studio job aggregates each worker's output per period per task type
   and posts:
     POST ${PORTAL_BASE_URL}/api/integration/work-summary
     Header: Authorization: Bearer <service-account key>   (scope worksummary:write)
     Body: { "summaries": [ {
       "userId":"<portal userId>", "periodStart":"<ISO>", "periodEnd":"<ISO>",
       "taskType":"…", "unitsCompleted":N, "unitsApproved":N, "unitsRejected":N,
       "avgQualityScore":0.0-1.0|null } ] }         // up to 1000 rows/call
   Idempotent upsert on (userId, periodStart, periodEnd, taskType, sourceSystem);
   sourceSystem is set server-side to your account name (`label_studio`). Unknown
   userIds → 422 (nothing written). These rows surface on the worker's /my-work.

5) PER-ANNOTATION WEBHOOK (Studio → Portal) — THE PAY CHANNEL.
   Configure Label Studio project webhooks to fire ANNOTATION_CREATED /
   ANNOTATION_UPDATED to:
     POST ${PORTAL_BASE_URL}/api/webhooks/label-studio
     Header: X-Valtaris-Webhook-Secret: <LABEL_STUDIO_WEBHOOK_SECRET>
   EVERY task MUST carry meta: { valtaris_user_id:"<portal userId>",
   item_count:N, is_gold:true|false }. Non-gold → a pending_qa payout enters the
   Portal's QA/validator/appeal state machine; gold → routes to qualification
   scoring, not pay. Idempotent per annotation id.

=== THE RECONCILIATION RULE (do not violate) ===
Two Studio→Portal channels describe the same work at different grains. To avoid
double-counting / contradictions:
- The per-annotation WEBHOOK is the ONLY channel that moves money and the QA
  authority for pay.
- WORK-SUMMARY is a REPORTING MIRROR, never a second pay source. Compute the
  summary from the SAME events you webhook, so the two agree by construction.
- A Studio consensus/QA score in a WorkSummary must NEVER flip a Portal payout
  status. At most it routes FUTURE work to sampling.
- Expect a Portal-side nightly drift check (payout-ledger vs summary) to raise an
  ops flag if they diverge — so keep them consistent.

INVARIANTS TO PRESERVE
- Studio never computes pay and never writes tier. Portal is source of truth.
- Identity maps on the opaque portal User.id ONLY — never join on email/name.
  Every task/annotation must be attributable via meta.valtaris_user_id.
- No PII crosses the bridge for matching; standing/verification return display
  fields only.
- Reactivation after a compliance/fraud block stays MANUAL (a human restores via
  the Portal) — do not auto-reactivate a worker in Studio.

WHAT REMAINS (Phase 5 — Studio-side build order, from design §8)
1. Connector skeleton: read `standing` before task assignment; respect
   accountStatus + tier/track gating.
2. Provisioning + membership: on Portal promotion set Studio project membership
   from standing; and make the set-active endpoint (item 2 above) actually END
   LIVE SESSIONS, not just block re-login.
3. Webhook wiring: register the ANNOTATION_* webhooks; guarantee every task
   stamps meta (valtaris_user_id, item_count, is_gold).
4. Aggregation job: nightly job that posts work-summary rows computed from the
   same events it webhooks (so reconciliation holds by construction).
5. Reconciliation: ensure Studio aggregation matches the payout-derived counts;
   the Portal already has a reconcile poll (reconcileFromLabelStudio).
6. Runbook: key rotation, webhook-secret rotation, incident response for
   drift/pay disputes.

CONVENTIONS: make reasonable decisions and note assumptions; flag legal/security
consequences; keep the reconciliation rule + invariants above; commit with
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; sync-before-push;
`git -C "C:\Users\User\Valtaris Studio"` for all git ops (never bare git add -A).

START BY:
1. Confirm the Studio repo identity: `git -C "C:\Users\User\Valtaris Studio" rev-parse --show-toplevel`
   and `remote -v` (must be Valtaris-Studio), branch, clean status.
2. Read C:\Users\User\Valtaris-Portal-preview\docs\label-studio-bridge-design.md
   (the authoritative design) + audit label_studio/valtaris_sso/ to see what SSO
   and set-active code already exists.
3. Confirm the Studio dev server runs on :8091.
4. Then tell me which Phase-5 item to build first (recommend: #2 — make set-active
   end live sessions — since the Portal already pushes it and it's the smallest
   verifiable slice, then #1 standing-gated assignment).
