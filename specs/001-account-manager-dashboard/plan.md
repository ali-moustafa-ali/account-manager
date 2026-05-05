# Implementation Plan: Account Manager Dashboard (Marketing Agency)

**Branch**: `001-account-manager-dashboard` | **Date**: 2026-05-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-account-manager-dashboard/spec.md`

## Summary

A single-tenant, single-user account-manager dashboard for a marketing agency in EGP. Tracks clients on a 50/50 monthly installment cycle (first half due day 1, second half due `lastDayOfMonth − 5`), with carry-forward of any unpaid Target into the next month. Surfaces Payment Status (Cleared / Partial / Pending / Overdue) computed from payments + due dates (never set manually), Special Services as separate one-off line items, and an in-app notification center for Overdue clients and stale items.

**Technical approach**: Next.js 16 App Router with React 19 Server Components + Server Actions (no separate REST API for the MVP — server actions invoked from client components). Postgres on **Supabase** via Drizzle ORM, using a direct Postgres connection (we do NOT use `@supabase/supabase-js` and we do NOT use Row-Level Security — RLS is disabled because the single-manager app has no per-row authorization). Single-user passcode auth (env-stored bcrypt hash + signed cookie). Each client has one of two billing cycles — `split-month` (50/50 calendar month, the default) or `anchor-day` (single payment on a manager-chosen day 1–28; period runs anchor-to-anchor). Period rollover by **lazy materialization on read** (the current period is computed from base data + the prior period's archived state) plus a daily Vercel cron at 00:05 Cairo to materialize closing/opening periods for whichever clients are at their rollover day. Tailwind v4 for styling, with the Impeccable design system mapped to CSS custom properties. Cormorant Garamond (serif display) + Instrument Sans (body) loaded via `next/font`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 20+
**Framework**: Next.js 16.2 (App Router) + React 19.2
**Styling**: Tailwind CSS v4 + CSS variables for the design tokens (cream surface, neutral text, status colors). Fonts via `next/font/google` — Cormorant Garamond + Instrument Sans.
**Persistence**: Postgres on **Supabase** via Drizzle ORM 0.36+. Connection via the Supabase project's direct Postgres URL (Settings → Database → Connection string → URI mode), NOT through the `@supabase/supabase-js` client. **Row-Level Security is disabled** because the single-manager app has no per-row authorization. Migrations checked into `lib/db/migrations/`.
**Auth**: Custom single-user passcode + iron-session-style signed cookie (no Auth.js / no OAuth — overkill for one user). Passcode hash stored in env (`MANAGER_PASSCODE_HASH`).
**Cron**: Vercel cron job (`vercel.json`) that hits `POST /api/cron/period-rollover` daily at 00:05 Africa/Cairo (= 22:05 UTC during summer / 21:05 UTC winter — schedule in UTC and the handler checks Cairo-local date). The cron runs daily because anchor-day clients each have their own rollover date — the handler iterates all active clients and skips those whose rollover isn't today.
**Validation**: `zod` for Server Action input validation.
**Date math**: `date-fns-tz` for Africa/Cairo timezone handling.
**Currency formatting**: Native `Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' })`.
**Testing**: Vitest for unit tests (status state machine + carry-forward chain). No E2E in MVP.
**Target Platform**: Vercel deploy. Modern browsers (Chrome / Safari / Firefox last 2 versions). Desktop-first; responsive but not mobile-optimized in v1.
**Project Type**: Single Next.js application (no separate frontend / backend).
**Performance Goals**: Dashboard with 50 clients renders in <1s on broadband; client-side filter/sort responds in <100ms (per SC-008).
**Constraints**: All amounts integer EGP (no fractional pounds — store as integer EGP, never float). All due-date math in Africa/Cairo. RTL-aware client name rendering inside otherwise-LTR table.
**Scale/Scope**: 1 manager, ≤200 clients in v1, ≤24 months of period history per client.

## Constitution Check

No `.specify/memory/constitution.md` exists for this fresh project. **Decision**: defer adopting a project constitution until after MVP ships — the spec + plan + tests provide sufficient guardrails for v1. (If we later notice repeated cross-cutting issues, that is the cue to write a constitution.)

## Project Structure

### Documentation (this feature)

```text
specs/001-account-manager-dashboard/
├── spec.md                  # ✅ Done
├── plan.md                  # ✅ This file
├── research.md              # ✅ Tech decisions with rationale
├── data-model.md            # ✅ Drizzle schema + ER diagram
├── quickstart.md            # ✅ Local setup + smoke test
├── contracts/
│   └── server-actions.md    # ✅ Server Action signatures + zod schemas
└── tasks.md                 # ⏳ Generated after plan approval
```

### Source Code (repository root)

```text
account/                                   # /Users/alimoustafa/Downloads/account
├── app/
│   ├── (auth)/
│   │   ├── sign-in/page.tsx               # passcode entry
│   │   └── layout.tsx                     # bare layout, no nav
│   ├── (dashboard)/
│   │   ├── layout.tsx                     # protected; header w/ bell + summary strip
│   │   ├── page.tsx                       # main dashboard (server component reads roster)
│   │   ├── clients/
│   │   │   ├── new/page.tsx               # add-client form
│   │   │   └── [id]/
│   │   │       ├── page.tsx               # client detail (periods, payments, services)
│   │   │       └── edit/page.tsx          # edit-client form
│   │   └── notifications/page.tsx         # full notification list
│   ├── actions/
│   │   ├── clients.ts                     # createClient, updateClient, deleteClient
│   │   ├── payments.ts                    # recordPayment, editPayment, deletePayment
│   │   ├── special-services.ts            # add/edit/toggle/delete
│   │   ├── notifications.ts               # markRead, markAllRead
│   │   └── auth.ts                        # signIn, signOut
│   ├── api/
│   │   └── cron/
│   │       └── period-rollover/route.ts   # POST — invoked by Vercel cron
│   ├── globals.css                        # Tailwind + CSS variables for design tokens
│   └── layout.tsx                         # root layout with fonts
├── components/
│   ├── ui/
│   │   ├── Button.tsx                     # primary / secondary / ghost / destructive
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Pill.tsx                       # status pill (4 variants)
│   │   ├── Dialog.tsx                     # confirm modal
│   │   └── Banner.tsx                     # top-of-page banner (overdue ≥3)
│   ├── dashboard/
│   │   ├── ClientTable.tsx                # client component: filter / sort / search state
│   │   ├── ClientRow.tsx
│   │   ├── SummaryStrip.tsx               # server component
│   │   ├── StatusFilter.tsx
│   │   ├── SearchBox.tsx
│   │   ├── OverdueBanner.tsx
│   │   └── NotificationBell.tsx           # client component, polls on focus
│   └── client/
│       ├── ClientForm.tsx                 # shared by new + edit
│       ├── PeriodCard.tsx                 # one card per period in detail view
│       ├── InstallmentRow.tsx             # I1 / I2 with paid-amount + due date
│       ├── PaymentForm.tsx                # record payment to (period, installment)
│       ├── PaymentList.tsx
│       ├── CreditList.tsx                 # prepaid credits
│       ├── SpecialServiceForm.tsx
│       └── SpecialServiceList.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts                      # Drizzle table definitions
│   │   ├── client.ts                      # db singleton (Neon driver)
│   │   ├── queries.ts                     # read-side queries (roster, detail, notifications)
│   │   └── migrations/                    # generated by drizzle-kit
│   ├── domain/
│   │   ├── period.ts                      # buildCurrentPeriod(client, payments, prevPeriod)
│   │   ├── status.ts                      # computeStatus(period, now) — pure function
│   │   ├── carry-forward.ts               # rolloverPeriod(closingPeriod) → openingPeriod
│   │   └── notifications.ts               # buildNotifications(allClients, allServices, now)
│   ├── auth/
│   │   ├── session.ts                     # cookie helpers (sign / verify)
│   │   ├── passcode.ts                    # bcrypt verify
│   │   └── guard.ts                       # requireAuth() for protected pages
│   ├── time/
│   │   └── cairo.ts                       # nowInCairo(), startOfMonthCairo(), etc.
│   └── utils/
│       ├── currency.ts                    # formatEGP(int) + parseEGP(string)
│       └── cn.ts                          # tailwind-merge helper
├── tests/
│   └── unit/
│       ├── status.test.ts                 # full truth table (Cleared/Partial/Pending/Overdue)
│       ├── carry-forward.test.ts          # 12-month chain test (SC-010-Carry)
│       ├── period.test.ts                 # buildCurrentPeriod edge cases
│       └── notifications.test.ts          # trigger correctness
├── scripts/
│   ├── seed.ts                            # seed 10 sample clients across all statuses
│   └── hash-passcode.ts                   # one-off: hash a passcode for env
├── public/
│   └── favicon.ico
├── .env.local.example
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                            # cron: 0 22 * * * → period-rollover
└── vitest.config.ts
```

**Structure Decision**: Single Next.js App Router project. No monorepo, no separate API. Server Actions handle all mutations; route handlers used only for the cron endpoint. Domain logic (status, carry-forward, period building, notifications) lives in `lib/domain/` as pure functions so it is unit-testable without database mocks.

## Complexity Tracking

No constitution violations. The areas where the design has non-trivial complexity are intentional and justified below — these are surfaced explicitly so reviewers can challenge them.

| Decision | Why | Simpler alternative rejected because |
|----------|-----|-------------------------------------|
| Materialize Period rows on rollover (vs derive on-read every time) | Carry-forward chain must be auditable and immutable — once closed, a period's `unpaid` becomes the next period's `carryForwardFromPrev` and must not silently change if the manager later edits an old payment | Pure derivation would mean editing a payment from 6 months ago retroactively rewrites every subsequent period's effectiveTarget. Manager-confusing and bug-prone. |
| Two-source status: lazy on read + cron on rollover | Lazy alone means clients only flip Overdue when someone opens the dashboard. Cron alone means a stale dashboard load between cron-fires shows wrong data. Both = correct + fresh. | Cron-only adds latency for the on-demand case. Lazy-only fails the automated notification trigger. |
| Custom passcode auth instead of Auth.js | Single user, no OAuth providers, no email infra needed for v1 — Auth.js adds 3 dependencies and a config surface for zero benefit | Auth.js works fine but introduces ceremony (callbacks, providers, adapters) we don't need. |
| Drizzle ORM (typed) instead of raw `pg` | Schema migrations + typed query builders prevent a class of bugs that's easy to hit on a 7-table model with composite keys (period: client + year + month) | Raw SQL is fine for tiny apps but the typing benefit pays for itself once we add Period and Installment relationships. |
| EGP stored as integer (not numeric/decimal) | All amounts are whole EGP. Integer arithmetic eliminates rounding bugs in carry-forward / installment splits. | Decimal would work but introduces formatter-edge-case complexity for zero benefit. |
| Per-client `billingCycle` enum instead of one cycle for everyone | Some clients pay 50/50 across the calendar month; others pay in a single shot on a custom day (e.g. day 5). Modeling both via an enum lets the dashboard treat them uniformly while the period-shape and installment count diverge per client. | A "one cycle for everyone" model would force the manager to fake an anchor-day client with a single split-month installment, breaking the 50/50 invariant and the dashboard column meanings. |
| Cycle and anchor-day snapshots stored on each Period row | A historical period must render exactly as it was billed at the time, even if the client has since changed their billingCycle or anchorDay. | Reading the live `clients.billing_cycle` would silently rewrite history when the manager flips a cycle. |

## Phase summary (the artifacts this plan produces)

- **Phase 0 — Research** (`research.md`): tech decisions + rationale. ✅ Authored alongside this plan.
- **Phase 1 — Design**:
  - `data-model.md` — entity tables, fields, relationships, indexes. ✅
  - `contracts/server-actions.md` — Server Action signatures with zod input/output. ✅
  - `quickstart.md` — install, env, seed, smoke. ✅
- **Phase 2 — Tasks** (`tasks.md`): generated by the next workflow step. ⏳ Pending plan approval.

## Implementation order recap (deferred to tasks.md)

1. **Setup**: `next` scaffold, deps install, Tailwind + design tokens, fonts, env scaffolding, Drizzle config, Vitest config.
2. **Foundational**: db schema + first migration, auth (passcode + cookie + guard), time utilities (Cairo TZ).
3. **US1 (P1)**: dashboard read path — roster query, summary strip, status pill, table + row, sort by status priority. Seed script for demo data.
4. **US2 (P1)**: client mutations (create/edit/delete) + payment mutations (record/edit/delete) + period materialization on rollover + carry-forward + lazy-read of current period.
5. **US3 (P2)**: Special Services CRUD, separate "owed" total on detail view.
6. **US4 (P2)**: Notification model + bell + banner + cron handler + per-notification mark-read.
7. **US5 (P3)**: status filter + column sort + name search + URL state.
8. **Polish**: a11y pass (focus rings, RTL labels, contrast against the cream surface), 50-client perf smoke, prod build, deploy.
