# Research: Account Manager Dashboard

**Feature**: `001-account-manager-dashboard`
**Date**: 2026-05-05

This document captures the technical decisions made for the MVP, with **rationale** and **rejected alternatives**. Each section is a single decision; if a decision turns out to be wrong, edit the section in place rather than appending corrections elsewhere.

---

## R-001: Framework — Next.js 16 App Router (RSC + Server Actions)

**Decision**: Next.js 16.2 with the App Router, React Server Components by default, Server Actions for all mutations. No tRPC, no separate REST API for the MVP — only one route handler exists (the cron endpoint).

**Rationale**:
- The user explicitly asked for Next.js 16.
- App Router + RSC is the right shape for a CRUD-heavy dashboard: read pages stream Postgres straight into the rendered HTML with zero JSON-over-HTTP overhead.
- Server Actions remove the boilerplate of writing a route + a fetch wrapper + a hook for every mutation. Form-based mutations work without JS.
- Single source of types end-to-end: zod schema defined once, consumed by both the Server Action and the client form.

**Rejected**:
- **Pages Router** — legacy, no benefit here.
- **Add tRPC layer** — overkill for a single client / server in the same repo. Re-introduces the boilerplate that Server Actions remove.
- **Add a REST API** — not needed for v1; if a mobile app is built later, the Server Action handlers can be exposed as routes trivially.

---

## R-002: Database — Postgres on Supabase via Drizzle ORM (direct Postgres connection, no RLS)

**Decision**: Postgres hosted on Supabase. Schema and migrations via Drizzle ORM (`drizzle-orm` + `drizzle-kit`). Connection is the **direct Postgres URL** (Settings → Database → Connection string → URI), NOT the Supabase JS client. Row-Level Security is **disabled** because the single-manager app has no per-row authorization. All amounts stored as `integer` columns representing whole EGP.

**Rationale**:
- **Supabase**: chosen by the user because they already have an account. We use only the Postgres database — not Auth, not Storage, not Realtime, not the JS client. This keeps the integration surface tiny and avoids adopting Supabase opinions we don't need (RLS, JWT-as-DB-context, PostgREST routing).
- **Direct Postgres connection (`postgres` driver)**: gives us straight SQL access via Drizzle. No PostgREST, no RLS overhead, no Auth-JWT plumbing. The Supabase URL works with any Postgres-compatible driver — Supabase is just managed Postgres for our purposes.
- **No RLS**: with a single user, there is no row-level access decision to make. Disabling RLS removes a class of "I forgot to add a policy" footguns. We rely on the cookie-gated app routes for authz.
- **Drizzle**: closest TypeScript ORM to "just write SQL but typed". No code generation step, no opaque magic. Migrations are SQL files generated from schema diffs — reviewable in PRs. Excellent TypeScript inference for joins.
- **Integer EGP**: all amounts in this app are whole EGP. Integers eliminate the round-half-up vs round-half-even bugs that float / decimal would introduce in the carry-forward chain. Display formatting is a presentation concern handled by `Intl.NumberFormat`.

**Rejected**:
- **Supabase JS client + PostgREST** — works, but ties the app to Supabase's flavor of REST and gives up Drizzle's typed query builder. We'd lose joins-as-types and gain nothing.
- **Supabase Auth** — replaced by our 50-line passcode auth. Adding Supabase Auth would mean a `users` table, JWT issuance, and the RLS plumbing we just disabled.
- **Neon** — comparable serverless Postgres, but the user already has Supabase and prefers a single account.
- **SQLite (file-based)** — beautiful for local-first apps, but Vercel's filesystem is ephemeral. Would force self-hosting just for storage.
- **Prisma** — fine ORM but heavier than Drizzle (engine binary, more codegen, slower cold start). Drizzle is plenty for 7 tables.
- **Numeric/Decimal columns** — wrong tool when all amounts are guaranteed integer. Adds rounding risk.

---

## R-003: Authentication — single passcode + signed cookie

**Decision**: One environment variable `MANAGER_PASSCODE_HASH` holds a bcrypt hash of the manager's passcode. Sign-in form posts the plain passcode, server-side compares with bcrypt, sets a signed cookie (HMAC-signed with `SESSION_SECRET`) valid 30 days. A `requireAuth()` helper reads the cookie in every protected layout / server action.

**Rationale**:
- Single user — there is no user table to maintain, no password reset flow needed (the manager re-runs `npm run hash-passcode` and updates the env if forgotten), no email infrastructure required for v1.
- ~50 lines of code total: bcrypt verify + HMAC cookie + middleware. Auditable in one sitting.
- No third-party auth dependency to keep up to date.
- Cookies are `HttpOnly`, `Secure`, `SameSite=Strict` — eliminates XSS token theft and CSRF on the auth cookie itself. Server Actions get separate CSRF protection from Next.js.

**Rejected**:
- **Auth.js (NextAuth v5)** — designed for multi-provider OAuth + multi-user sessions. Drags in adapters, callbacks, providers — a config surface that is pure overhead for one user.
- **Magic link via Resend** — nicer UX (no password to remember) but introduces an email dependency, mailbox-delivery friction (spam folder), and a token-store schema. Defer to v2 if/when multi-user is added.
- **HTTP Basic Auth at Vercel edge** — would work, but loses sign-out, has poor UX on mobile, and leaks the passcode to every request log.

---

## R-004: Period rollover — lazy materialization on read + nightly cron safety net

**Decision**: The "current period" for each client is computed on every dashboard read by combining: the client's standing `Target Cost`, the most recent **closed** period's record (which has `unpaid` and any `creditForNextPeriod` amounts), and the payments recorded against the current month so far. A Vercel cron at 00:05 Africa/Cairo on day 1 of each month runs `closePreviousPeriod()` for every active client — this writes a `Period` row with the closing values and triggers any rollover-time notifications.

**Rationale**:
- **Lazy on read** keeps the dashboard always-correct even if the cron is delayed or fails. No "I refreshed at 12:01 AM and it shows yesterday's status" bug.
- **Cron on rollover** materializes the closed period so the carry-forward chain is preserved as immutable history. Without this, editing a 6-month-old payment would silently rewrite every subsequent period's `effectiveTarget`.
- The two together = correct AND fresh AND auditable.
- Cron schedule in `vercel.json` is in UTC; the handler converts to Cairo local time and skips no-op days. Idempotent — running twice on day 1 is safe.

**Rejected**:
- **Pure-derive-on-read (no materialization)** — fails the audit requirement. A historical edit becomes a surprise time-travel bug.
- **Pure cron-only (no lazy)** — fails the freshness requirement when the cron is late or the user opens the page exactly at midnight.
- **Per-period rows persisted from creation (no derivation)** — would require write-side logic on every payment to also create the open period, complicating the mutation path. Lazy-on-read keeps the "current period" view a pure function.

---

## R-005: Visual design system — Impeccable mapped to Tailwind v4 + CSS variables

**Decision**:
- **Color tokens** defined as CSS custom properties on `:root` in `globals.css`, consumed by Tailwind v4 utilities via `@theme inline`.
- Surface: `--surface-1` cream (`oklch(98% 0.01 80)`), `--surface-2` slightly darker for cards (`oklch(96% 0.012 80)`).
- Text: `--ink-1` deep neutral (`oklch(20% 0.01 270)`), `--ink-2` muted, `--ink-3` very muted.
- Status palette (the ONLY saturated colors):
  - **Cleared**: `oklch(50% 0.10 145)` (muted green) on `oklch(94% 0.04 145)` background — ghost pill.
  - **Partial**: `oklch(55% 0.15 75)` (amber) on `oklch(94% 0.06 75)` background — soft pill.
  - **Pending**: neutral — same as `--ink-2` on `--surface-2`. Acts as "no signal".
  - **Overdue**: `oklch(98% 0.01 0)` ink on `oklch(48% 0.20 25)` saturated red background — solid pill, the highest-emphasis treatment in the app.
- **Typography**: Cormorant Garamond (Google) for `font-display`, Instrument Sans (Google) for `font-sans`. Both loaded via `next/font/google` with `display: 'swap'`.
- **Radii**: `--radius-card: 0.75rem (12px)`, `--radius-pill: 9999px`. No nested cards; the dashboard table is a single card, not a grid of card-rows.
- **Spacing**: Tailwind defaults (4px base). Generous whitespace — table row vertical padding ≥ 16px.
- **No gradients. No drop shadows beyond a single faint `0 1px 2px rgb(0 0 0 / 4%)` on the dashboard surface.**

**Rationale**:
- The user explicitly cited https://impeccable.style/ as the visual reference — restrained, neutral, calm, "anti-AI-slop".
- OKLCH gives perceptually-uniform color and ages better than HSL when we extend the palette.
- Cormorant Garamond + Instrument Sans is one of the two pairings the Impeccable docs explicitly recommend.
- Status pills are the only place a marketing-agency dashboard *needs* color — saving saturation for them makes them impossible to miss.

**Rejected**:
- **shadcn/ui** — fine library, but its default Tailwind tokens push toward a generic SaaS look. Building a small primitive set ourselves is faster than retheming shadcn for ~6 components.
- **Material / Chakra / Mantine** — all carry their own design opinion that fights the Impeccable reference.
- **HSL / RGB tokens** — works, but OKLCH is strictly better at preserving lightness when adjusting hue.

---

## R-006: Form validation + Server Action contracts — zod everywhere

**Decision**: Every Server Action defines a `zod` schema for its input. The same schema is exported and consumed by the client form for client-side validation. Action returns either `{ ok: true, data }` or `{ ok: false, error: { field?: string, message: string } }` — never throws across the RSC boundary.

**Rationale**:
- Single source of truth for what's allowed (e.g. `targetCost: z.number().int().min(0).max(9_999_999)`).
- Discriminated-union return type makes client handling explicit and impossible to forget.
- zod errors map naturally to per-field form messages.

**Rejected**:
- **valibot** — smaller bundle but not a meaningful saving here; zod's error messages are richer.
- **Hand-rolled validators** — reinvents the wheel and loses the typed inference.

---

## R-007: Time and timezone — `date-fns-tz` + integer day boundaries

**Decision**: All date math happens in Africa/Cairo via `date-fns-tz`. The "current month" is determined by `format(now, 'yyyy-MM', { timeZone: 'Africa/Cairo' })`. Installment due dates are stored as `YYYY-MM-DD` strings (not timestamps) since they represent a calendar day, not a moment.

**Rationale**:
- Postgres `date` type + ISO string serialization avoids the entire timezone-as-timestamp class of bugs (e.g. "the row says 2026-04-30 23:00:00 UTC but the manager sees 2026-05-01").
- `date-fns-tz` is the de-facto choice for timezone-aware computations in JS without pulling in moment-timezone (deprecated).
- The Overdue threshold flips on a *day* boundary — not a *moment* — so storing the threshold as a date is exact.

**Rejected**:
- **`luxon`** — fine but heavier than date-fns-tz and we don't need its DateTime abstraction.
- **Store everything as UTC timestamps** — leaks UTC into the query layer and forces every read to convert. Worse for debugging.

---

## R-008: Notification scheduling — derived on-read, not pushed

**Decision**: Notifications are not stored as events. The notification list is **computed on every dashboard / notifications-page load** by scanning all clients + special services and applying the trigger rules from FR-020. Read-state is the only thing persisted: a small `notification_read_state` table with a stable hash of `(triggerType, clientId, optionalServiceId, fireDateAtDayPrecision)` mapped to `readAt`.

**Rationale**:
- Triggers are pure functions of the data: "client X has been Pending for 8 days" is recomputable any time. Storing them as events would require a separate write on every status transition AND a cleanup job for resolved triggers.
- Computed-on-read means an Overdue notification automatically disappears when the manager records the missing payment — no event-cleanup gymnastics.
- Read-state is a tiny table (one row per acknowledged notification, max ~hundreds of rows ever for a single user).

**Rejected**:
- **Notification table with append-on-trigger + soft-delete-on-resolve** — works but adds a write path for every status transition and a cleanup task. More moving parts for the same UX.
- **Realtime push (websockets / SSE)** — out of scope for v1. The dashboard is a page the manager loads; a polling refresh on focus is enough.

---

## R-009: Testing — Vitest unit tests for the domain layer only

**Decision**: Unit tests with Vitest for `lib/domain/*` only — `status.ts`, `carry-forward.ts`, `period.ts`, `notifications.ts`. No tests for components, no E2E tests in v1. Aim for ≥ 90% line coverage on the domain layer; the rest is "tested by use".

Required test cases (driven by the SC-004 truth table):
- **Status truth table for `split-month`**: 12 cases — 3 date positions × 4 paid amounts.
- **Status truth table for `anchor-day`**: 12 cases — 3 date positions × 4 paid amounts.
- **Carry-forward chain**: 12 consecutive months for both cycles (split-month and anchor-day) with the client paying exactly half each period — assert the effective Target accumulates as expected (SC-010-Carry).
- **Period boundary computation**: split-month onboarding mid-month, anchor-day onboarding mid-period, anchor day = 28 in February, anchor day in a 30-day month vs 31-day month.
- **Cycle change**: a client switching from split-month to anchor-day mid-period leaves the current period intact and reshapes the next one.
- **Notification triggers**: each of `newly-overdue`, `pending-stale (> 7 days)`, `special-service-unpaid-long (> 30 days)` — fired correctly and resolved on the next read when the underlying condition disappears.

**Rationale**:
- The status state machine and carry-forward chain are the only places where a regression silently corrupts financial data. They are pure functions, so unit-testing them is cheap and high-leverage.
- Component tests for a v1 dashboard would mostly assert against the design — wasted effort while the design is still settling.
- Manual smoke testing via the `quickstart.md` checklist is enough for the MVP. Add Playwright E2E in v2 if regressions appear.

**Rejected**:
- **Testing-Library on every component** — high cost, low value for a small UI surface owned by one person.
- **Playwright E2E in v1** — defer; the value is in catching regressions across releases, and v1 has no prior release.

---

## R-010: Deployment — Vercel + Neon, single environment

**Decision**: One Vercel project (`account-dashboard`) with one Neon database. No staging environment in v1 — the manager works against production, with the seed script available locally for experimenting before each push. Branch deploys are auto-disabled to keep the database one-and-only.

**Rationale**:
- Single user — there is no traffic to A/B test against, no "broke prod for everyone" risk worth a staging environment.
- A staging environment would require a second Neon database, env var management, and a second Vercel project. Pure overhead.
- The cost of a small mistake is "the manager opens the page and sees something weird, then I revert" — not "10,000 users got bad data".

**Rejected**:
- **Staging + prod with a promotion flow** — appropriate for SaaS, overkill for one user.
- **Self-hosted on a VPS** — possible but adds DevOps overhead for zero benefit at this scale.
