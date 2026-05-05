# Quickstart: Account Manager Dashboard

**Feature**: `001-account-manager-dashboard`
**Date**: 2026-05-05

This is the day-one setup guide. Follow it top-to-bottom on a fresh machine to get from "empty repo" to "dashboard running locally with seeded data".

---

## Prerequisites

- **Node.js 20+** — `node -v` should print `v20.x` or higher.
- **A Supabase account** (free tier is enough). Create a new project; from the Supabase dashboard go to **Settings → Database → Connection string → URI** and copy the connection string. Use the **Transaction mode (pooled)** URL — it ends in `:6543/postgres` and is safe for serverless. Replace `[YOUR-PASSWORD]` with the database password you set when creating the project.
- **(Optional) Vercel account** — only needed when deploying.

---

## 1. Clone & install

```bash
cd /Users/alimoustafa/Downloads/account
# (project files are already in this directory after `tasks.md` setup phase)
npm install
```

## 2. Environment

Copy the example env file and fill in three secrets.

```bash
cp .env.local.example .env.local
```

`.env.local` contents:

| Variable                | Purpose                                                                  | How to generate                                              |
|-------------------------|--------------------------------------------------------------------------|--------------------------------------------------------------|
| `DATABASE_URL`          | Supabase Postgres connection string (pooled, port 6543)                  | Settings → Database → Connection string → URI (Transaction mode) |
| `MANAGER_PASSCODE_HASH` | bcrypt hash of the manager's passcode                                    | `npx tsx scripts/hash-passcode.ts 'YOUR_PASSCODE_HERE'`      |
| `SESSION_SECRET`        | HMAC secret for the session cookie (≥ 32 chars, random)                  | `openssl rand -base64 48`                                    |
| `CRON_SECRET`           | Shared secret for the rollover cron endpoint                             | `openssl rand -base64 32`                                    |

The `hash-passcode.ts` script prints the hash to stdout — paste it into `.env.local`. Never commit `.env.local`.

## 3. Database setup

Apply migrations to your Neon database:

```bash
npm run db:migrate
```

Verify the schema:

```bash
npm run db:studio   # opens drizzle-kit's table browser at http://localhost:4983
```

You should see seven tables: `clients`, `periods`, `installments`, `payments`, `credits`, `special_services`, `notification_read_state`.

## 4. Seed sample data

```bash
npm run seed
```

This inserts 10 sample clients designed to exercise every Payment Status:
- 3 Cleared, 3 Partial, 2 Pending, 2 Overdue
- One client with a multi-month carry-forward chain
- One client with a prepaid credit toward next month
- One client with 3 Special Services (1 paid, 2 unpaid, one of which is > 30 days old)

Re-running `npm run seed` is destructive — it truncates and re-inserts. There's no production safety check; never run it against production.

## 5. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/sign-in`. Enter the passcode you hashed in step 2.

---

## Smoke test (5 minutes)

Walk through this checklist after every meaningful change. It exercises the MVP path end-to-end.

- [ ] **Sign in** — wrong passcode shows error; right passcode lands on `/dashboard`.
- [ ] **Dashboard renders** — all 10 seeded clients visible, summary strip shows totals, Overdue rows sorted to the top, `Overdue ≥ 3` banner shows if seed includes ≥ 3 overdue.
- [ ] **Status pills** — each of Cleared / Partial / Pending / Overdue is visually distinct and matches the seed expectations.
- [ ] **Add a client** — `+ Add client` button → form → submit → new row appears in the table within 1s.
- [ ] **Edit a client** — click a row → detail page → edit Target → save → dashboard reflects the change.
- [ ] **Record a payment** — on a Pending client's detail page, record a payment for half the Target → status flips to Partial → dashboard updates.
- [ ] **Record a payment that clears** — record the second half → status flips to Cleared → Remaining = 0.
- [ ] **Record a credit** — on a Cleared client, record a payment targeting next month, slot=1 → "Credit toward next period" line appears in detail view, dashboard's current row unchanged.
- [ ] **Add a Special Service** — add an unpaid service → detail page shows it under Unpaid, "Special Services owed" total is correct, dashboard's package Remaining is unchanged.
- [ ] **Toggle a Special Service to paid** — the service moves to the Paid section, owed total decreases.
- [ ] **Notifications** — bell icon shows correct count, clicking a notification navigates to the right client, marking-read decreases the badge.
- [ ] **Filter by status** — check Overdue + Pending → table shows only those.
- [ ] **Sort by Remaining** — column header click → descending; click again → ascending.
- [ ] **Search by name** — type partial Arabic or Latin substring → matching rows visible only.
- [ ] **URL persistence** — apply a filter + sort + search → reload → same view restored.
- [ ] **RTL client name** — at least one seeded client has an Arabic name; verify it renders right-aligned within its cell while the rest of the table stays LTR.
- [ ] **Sign out** — clicking sign-out clears the cookie and redirects to `/sign-in`.

---

## Triggering the rollover cron locally

The cron only runs in production (Vercel). To test the rollover logic locally:

```bash
curl -X POST http://localhost:3000/api/cron/period-rollover \
  -H "x-vercel-cron-signature: $CRON_SECRET" \
  -H "x-test-date: 2026-06-01"   # optional: simulate a specific Cairo date
```

The response is `{ rolledOver, clientsProcessed, errors }`. Re-running the same call is idempotent — it should return `rolledOver: 0` the second time for the same date.

---

## Deploy to Vercel

```bash
vercel link
vercel env pull .env.production   # only if you've already set them via the dashboard
```

Set the four environment variables in the Vercel project settings (`DATABASE_URL`, `MANAGER_PASSCODE_HASH`, `SESSION_SECRET`, `CRON_SECRET`).

Push to `main` — Vercel auto-deploys. The cron is configured in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/period-rollover", "schedule": "5 22 * * *" }
  ]
}
```

(`05:00 Cairo time` ≈ `22:05 UTC`. The handler internally checks Cairo-local date and no-ops on non-day-1 dates.)

---

## Troubleshooting

- **`bcrypt`-related install errors on Apple Silicon** — use `bcryptjs` instead (pure JS, no native build). Update `lib/auth/passcode.ts` import.
- **Drizzle "relation does not exist"** — re-run `npm run db:migrate`. If the schema is corrupted, drop the public schema in the Supabase SQL editor (`drop schema public cascade; create schema public;`) and re-migrate.
- **`pg` driver "remaining connection slots reserved"** — make sure you're using the **pooled** Supabase URL (port 6543), not the direct connection (port 5432). Direct connections have a low limit and are not safe for serverless.
- **Cron not firing in Vercel** — confirm Pro plan or higher (Hobby plan has cron limitations). Verify `CRON_SECRET` env var matches what the handler expects.
- **Status doesn't update after recording a payment** — check that the payment's `targetYear`/`targetMonth` match the current period. Mismatched targeting (e.g. recording May's payment with `targetMonth: 6`) is intentional — that becomes a credit.
- **All clients show Overdue on day 1** — the cron didn't run (check Vercel cron logs) OR `Africa/Cairo` resolution is failing on the runtime (set `TZ=Africa/Cairo` in Vercel env as a belt-and-suspenders).
