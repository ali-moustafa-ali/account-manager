# Account Manager Dashboard

A single-tenant client tracker for a marketing agency: package costs, monthly
targets, payments per installment, special services, and a notification inbox
for overdue clients. Built with Next.js 16 + React 19 + Drizzle on Supabase
Postgres. Designed in the spirit of [impeccable.style](https://impeccable.style/).

```
ƒ /                                  dashboard + filter/sort/search
ƒ /sign-in                           single-passcode auth
ƒ /clients/new                       add client (split-month or anchor-day cycle)
ƒ /clients/[id]                      detail + record payment + special services
ƒ /clients/[id]/edit                 edit client
ƒ /clients/[id]/delete               name-confirm delete
ƒ /notifications                     inbox + mark read
ƒ /api/cron/period-rollover          daily rollover (Vercel cron, 00:05 Cairo)
```

## What this app actually does

Each client has a **billing cycle**:

- **`split-month`** — calendar-month period with two installments: floor(Target/2) due day 1, the remainder due `lastDayOfMonth − 5`.
- **`anchor-day`** — period runs anchor-to-anchor (e.g. day 5 → day 4 next month). Single installment due on the anchor day.

Any portion of one period's Target that goes unpaid is **carried forward** into the next period's `effectiveTarget`. Prepaid amounts toward future periods are tracked as **credits** and applied automatically on rollover.

Payment Status is computed from `paid` vs the installment due dates — never set manually:

| Status | Condition |
|--------|-----------|
| **Cleared** | `paid >= effectiveTarget` |
| **Pending** | `paid == 0` and no installment due date has passed |
| **Overdue** | `paid < ExpectedByNow` (sum of installment amounts whose due date is past) |
| **Partial** | anything in between |

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind v4 + CSS variables (Impeccable design tokens) |
| Fonts | Cormorant Garamond (display) + Instrument Sans (body) via `next/font/google` |
| Database | Postgres on Supabase (pooled, port 6543) via Drizzle ORM 0.36 |
| Auth | Single-passcode + bcrypt + HMAC signed cookie (no third-party auth) |
| Validation | zod everywhere (forms, server actions, cron payload) |
| Time | `date-fns-tz` with `Africa/Cairo` |
| Currency | Integer EGP only (no float / no decimal) |
| Tests | Vitest unit tests on the domain layer (status / period / carry-forward / notifications) |
| Hosting | Vercel + Vercel Cron |

## Local setup

Prerequisites: Node 20+, a Supabase project (free tier).

```bash
git clone https://github.com/ali-moustafa-ali/account-manager.git
cd account-manager
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:

```ini
# Supabase Settings → Database → Connection string → URI → Transaction mode (port 6543)
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

# bcrypt hash for the single passcode. Generate with the command below.
MANAGER_PASSCODE_HASH='$2a$10$...'

# Random 32+ chars (openssl rand -base64 48)
SESSION_SECRET=...

# Random 32+ chars (openssl rand -base64 32)
CRON_SECRET=...
```

> **Tip:** wrap the bcrypt hash in single quotes — Next.js's env loader expands `$VAR` references and a bcrypt hash contains three `$` characters.

Generate the passcode hash:

```bash
npm run hash-passcode 'your-passcode-here'
```

Apply the schema and seed demo data:

```bash
npm run db:migrate    # creates 7 tables in Supabase
npm run seed          # inserts 10 demo clients across all 4 statuses
npm run dev           # http://localhost:3000
```

Sign in with the passcode you chose.

## Deploy to Vercel

1. Import the GitHub repo at <https://vercel.com/new>.
2. In **Settings → Environment Variables**, add the same four vars from `.env.local` (use a *different* `MANAGER_PASSCODE_HASH` than your local one — never share secrets).
3. Push to `main` — Vercel auto-deploys.
4. Confirm the cron job appears in **Settings → Cron Jobs** (`/api/cron/period-rollover` daily at `5 22 * * *` UTC ≈ 00:05 Cairo).

## Tests

```bash
npm test          # 71 unit tests, ~500ms
npm run test:watch
```

Tests cover: status state machine (24 cases × 2 cycles), 12-month carry-forward chain, period boundary edge cases (anchor=28 in February, year wrap), notification triggers + read-state correctness.

## Documentation

The full spec, plan, data model, server-action contracts, and quickstart all live under [`specs/001-account-manager-dashboard/`](specs/001-account-manager-dashboard/):

| File | Contents |
|------|----------|
| [`spec.md`](specs/001-account-manager-dashboard/spec.md) | 5 user stories (P1–P3) + 31 functional requirements + 13 edge cases |
| [`plan.md`](specs/001-account-manager-dashboard/plan.md) | Tech stack, project structure, complexity tracking |
| [`data-model.md`](specs/001-account-manager-dashboard/data-model.md) | 7 tables + 9 invariants + ER diagram |
| [`contracts/server-actions.md`](specs/001-account-manager-dashboard/contracts/server-actions.md) | All Server Action signatures with zod schemas |
| [`research.md`](specs/001-account-manager-dashboard/research.md) | 10 decisions with rationale + rejected alternatives |
| [`quickstart.md`](specs/001-account-manager-dashboard/quickstart.md) | Local setup + 17-step smoke checklist |
| [`tasks.md`](specs/001-account-manager-dashboard/tasks.md) | Implementation tasks (T001–T072) grouped by phase |

## License

Private project. All rights reserved.
