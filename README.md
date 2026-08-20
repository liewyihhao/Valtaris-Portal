# Valtaris Annotator Portal

The recruitment-to-payout workforce platform for **Valtaris** — the applicant
funnel, qualification testing, annotator workspace, payouts and appeals, plus an
internal ops console.

> The public marketing website lives in a **separate** repo,
> [`liewyihhao/Valtaris-Website`](https://github.com/liewyihhao/Valtaris-Website).
> Keep the two apps separate — do not mix portal code into the website or vice-versa.

Built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS**, **Prisma**,
and **NextAuth / Auth.js v5**.

## Getting started

Local dev uses **SQLite** — zero setup, no Docker, no Postgres.

```bash
cp .env.example .env          # DATABASE_URL="file:./dev.db", AUTH_SECRET=...
npm install
npm run db:push               # create the SQLite db + tables
npm run db:seed               # load demo tracks, users, payouts, appeals
npm run dev                   # http://localhost:3000
```

**Demo accounts** (password `password123` for all):

| Email | Role | Use it to see |
|---|---|---|
| `applicant@example.com` | applicant | the funnel from the top (`/apply`) |
| `t2.text@example.com` | annotator | earnings, an open appeal, payouts |
| `ops@valtaris.ai` | ops | the review queue (`/admin`) |
| `admin@valtaris.ai` | admin | everything, incl. ops console |

```bash
npm test          # unit tests (payout state machine + questionnaire routing)
npm run build     # production build (runs `prisma generate` first)
npm start         # serve the production build
npm run db:studio # inspect the database
```

### Production database (PostgreSQL)

Set `provider = "postgresql"` in `prisma/schema.prisma`, point `DATABASE_URL` at
Postgres, and re-run `db:push` / `db:seed`. A `docker-compose.yml` (Postgres on
host port 5433 + Label Studio CE) is included for that path.

## Structure

```
app/
  layout.tsx        Root layout (fonts, portal metadata)
  (public)/         Public: landing (/), how-it-works, legal/{terms,privacy}
  (auth)/           login, signup
  (portal)/         apply funnel, dashboard, earnings, appeals, profile, payment-details
  (ops)/            admin console (rate cards, questions, workers, guidelines, Label Studio)
  api/              route handlers (auth, apply, payouts, appeals, admin, jobs, webhooks)
middleware.ts       edge role-gating (AUTHED_PREFIXES / STAFF_PREFIXES)
auth.ts             NextAuth (Node) — credentials provider, Prisma
auth.config.ts      edge-safe base config (JWT only)
lib/
  db.ts             Prisma client
  portal/           business logic (payout, questionnaire, qualification, earnings, …)
  utils.ts
components/
  portal/           portal UI (nav, forms, ui kit)
  ui/ brand/        shared generic UI used by public pages
prisma/             schema.prisma + seed.ts
docs/               architecture.md, api.md
```

### Design tokens

The portal's dark theme lives as CSS variables in `app/globals.css`, surfaced as
`p-*` Tailwind tokens (`p-base`, `p-surface`, `p-accent`, …) — never hardcode hex.

## Follow-ups before production

- **Label Studio provisioning**, **payout execution** (`lib/portal/payout-provider.ts`),
  **sanctions screening** (`lib/portal/screening.ts`) and **email verification**
  are clearly-labelled stubs behind interfaces — wire real providers.
- **Legal text** (agreements, ToS, privacy) is PLACEHOLDER — replace after review.
- **Tax IDs / account refs** are masked in this demo; encrypt/tokenize for real.
- The **job runner** (`/api/jobs/run`) and reconciliation are meant to be hit by a
  scheduler (cron / Vercel Cron / GitHub Action) hourly.
- Set a strong **`AUTH_SECRET`** in the deployment environment.
