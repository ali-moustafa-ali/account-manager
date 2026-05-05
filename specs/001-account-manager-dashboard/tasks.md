---
description: "Task list for Account Manager Dashboard (001) — implementable per-user-story"
---

# Tasks: Account Manager Dashboard (Marketing Agency)

**Input**: Design documents from `/specs/001-account-manager-dashboard/`
**Prerequisites**: [plan.md](./plan.md) ✅, [spec.md](./spec.md) ✅, [research.md](./research.md) ✅, [data-model.md](./data-model.md) ✅, [contracts/server-actions.md](./contracts/server-actions.md) ✅

**Tests**: Included for the domain layer only (status state machine, carry-forward chain, period building, notification triggers) per the testing decision in [research.md R-009](./research.md). No component tests, no E2E in v1.

**Organization**: Tasks are grouped by user story per the spec-kit template. Each US phase ends with a Checkpoint that says "this story is independently testable now".

## Format: `[ID] [P?] [Story?] Description`

- **[P]** — can run in parallel with other [P] tasks in the same phase (different files, no shared dependencies).
- **[US#]** — which user story (from spec) this task belongs to.
- **[F]** — Foundational (no story attribution, blocks all stories).
- **[S]** — Setup (no story attribution, blocks Foundational).
- **[Polish]** — cross-cutting cleanup at the end.

Path conventions follow [plan.md](./plan.md) Project Structure section.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the Next.js 16 project, install dependencies, wire up the design tokens + fonts, set up Drizzle + Vitest. Nothing depends on a database connection yet.

- [ ] **T001** [S] Initialize a Next.js 16.2 project at `/Users/alimoustafa/Downloads/account/` with `npx create-next-app@16.2.4` — App Router, TypeScript, Tailwind v4, no `src/` directory, no ESLint default (we'll configure ours), no `import alias` change. Confirm `package.json` shows `"next": "16.2.4"`, `"react": "19.2.4"`.
- [ ] **T002** [S] Install runtime dependencies: `drizzle-orm postgres @types/pg zod bcryptjs date-fns date-fns-tz tailwind-merge clsx`. Install dev dependencies: `drizzle-kit @types/bcryptjs vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`. Pin `drizzle-orm` to `^0.36`, `vitest` to `^4.1`.
- [ ] **T003** [S] [P] Configure `tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`, path alias `"@/*": ["./*"]`. Verify `npx tsc --noEmit` passes on the empty scaffold.
- [ ] **T004** [S] [P] Replace `app/globals.css` with Tailwind v4 setup + design tokens per [research.md R-005](./research.md#r-005-visual-design-system--impeccable-mapped-to-tailwind-v4--css-variables): cream `--surface-1 oklch(98% 0.01 80)`, ink scale, status palette (cleared/partial/pending/overdue), radii, and a `@theme inline` block exposing them to Tailwind utilities.
- [ ] **T005** [S] [P] Configure `next/font/google` in `app/layout.tsx`: load Cormorant Garamond as `--font-display` and Instrument Sans as `--font-sans` (both with `display: 'swap'`). Wire them through Tailwind in `tailwind.config.ts` so `font-sans` and `font-display` utilities resolve correctly.
- [ ] **T006** [S] [P] Create `.env.local.example` with the four documented vars (`DATABASE_URL`, `MANAGER_PASSCODE_HASH`, `SESSION_SECRET`, `CRON_SECRET`) and inline comments per [quickstart.md](./quickstart.md).
- [ ] **T007** [S] Create `drizzle.config.ts` pointing at `lib/db/schema.ts` for schema and `lib/db/migrations/` for output. Use the `postgres` driver. Add `npm run db:generate`, `npm run db:migrate`, `npm run db:studio` scripts to `package.json`.
- [ ] **T008** [S] Create `lib/db/client.ts` exporting a singleton `db = drizzle(postgres(env.DATABASE_URL))`. Use Node's `globalThis` cache pattern to survive HMR in dev without leaking connections.
- [ ] **T009** [S] [P] Configure `vitest.config.ts` with `environment: 'node'` (we only test pure domain functions), `globals: true`, `coverage` enabled with `v8` provider. Add `npm test` and `npm run test:watch` to `package.json`.
- [ ] **T010** [S] [P] Create `vercel.json` with the daily cron entry pointing at `/api/cron/period-rollover` at `5 22 * * *` UTC (≈ 00:05 Africa/Cairo).
- [ ] **T011** [S] [P] Write `scripts/hash-passcode.ts` (CLI: `npx tsx scripts/hash-passcode.ts 'mysecret'`) that bcrypts the input and prints the hash. Used once per machine to populate `MANAGER_PASSCODE_HASH`.

**Checkpoint**: Project scaffolded, dependencies installed, design tokens wired, db client compiles, Vitest runs (with no tests yet). `npm run dev` launches a blank app at `localhost:3000`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema + migrations, auth (passcode + cookie + guard), Cairo timezone helpers. **No user story can begin before this phase is done.**

⚠️ **CRITICAL**: T012–T020 form the foundation that every US depends on.

### Database

- [ ] **T012** [F] Define Drizzle enums in `lib/db/schema.ts`: `client_status` (`active`, `paused`), `billing_cycle` (`split-month`, `anchor-day`).
- [ ] **T013** [F] Define `clients` table in `lib/db/schema.ts` per [data-model.md](./data-model.md#clients) — including the `clients_anchor_day_chk` check constraint that anchor_day is set iff billing_cycle = 'anchor-day'.
- [ ] **T014** [F] Define `periods` table in `lib/db/schema.ts` per [data-model.md](./data-model.md#periods) — including `cycle_snapshot`, `anchor_day_snapshot`, `period_start_date`, `period_end_date`, and the unique index on `(client_id, year, month)`.
- [ ] **T015** [F] Define `installments` table in `lib/db/schema.ts` per [data-model.md](./data-model.md#installments) — including the unique index on `(period_id, slot)`.
- [ ] **T016** [F] Define `payments` table in `lib/db/schema.ts` per [data-model.md](./data-model.md#payments) — including the `(client_id, target_year, target_month)` index.
- [ ] **T017** [F] Define `credits` table in `lib/db/schema.ts` with composite PK `(client_id, target_year, target_month)` per [data-model.md](./data-model.md#credits).
- [ ] **T018** [F] Define `special_services` table in `lib/db/schema.ts` per [data-model.md](./data-model.md#special_services) — including the partial index on `(paid, service_date) WHERE paid = false`.
- [ ] **T019** [F] Define `notification_read_state` table in `lib/db/schema.ts` per [data-model.md](./data-model.md#notification_read_state).
- [ ] **T020** [F] Generate the initial migration with `npm run db:generate`, review the SQL diff, then apply with `npm run db:migrate` against the Supabase DB. Confirm in Supabase SQL editor that all 7 tables + indexes + constraints exist.

### Time + auth

- [ ] **T021** [F] [P] Build `lib/time/cairo.ts` with: `nowInCairo()`, `todayInCairo(): string` (YYYY-MM-DD), `startOfMonthCairo(year, month)`, `lastDayOfMonthCairo(year, month)`, `daysFromCairo(date1, date2)`. Uses `date-fns-tz` with `'Africa/Cairo'`.
- [ ] **T022** [F] [P] Build `lib/auth/passcode.ts` with `verifyPasscode(plain: string): Promise<boolean>` that bcrypts against `env.MANAGER_PASSCODE_HASH` in constant time.
- [ ] **T023** [F] [P] Build `lib/auth/session.ts` with `signSession()`, `verifySession()`, `setSessionCookie()`, `clearSessionCookie()` — HMAC-signed using `env.SESSION_SECRET`, 30-day expiry, `HttpOnly Secure SameSite=Strict`.
- [ ] **T024** [F] Build `lib/auth/guard.ts` with `requireAuth()`: server-side function that reads the session cookie, verifies it, and either returns the session or `redirect('/sign-in')`. Used by every protected layout / server action.
- [ ] **T025** [F] Build `app/(auth)/sign-in/page.tsx` (form posts to `signIn` action) and `app/actions/auth.ts` exporting `signIn(passcode)` and `signOut()` per [contracts/server-actions.md#auth](./contracts/server-actions.md#auth-appactionsauthts). Implement the rate limit (5/5min/IP) using a simple in-memory Map (single-instance is fine for one user).
- [ ] **T026** [F] Build `app/(auth)/layout.tsx` (bare layout) and the dashboard `app/(dashboard)/layout.tsx` that calls `requireAuth()` at the top and renders the header (logo + sign-out + bell placeholder).

**Checkpoint**: Migrations applied. Sign-in works end-to-end (can sign in with the right passcode, get cookie, hit `/dashboard` and see a placeholder; signing out clears the cookie). All US phases can now begin.

---

## Phase 3: User Story 1 — Account manager sees the full client roster (Priority: P1) 🎯 MVP

**Goal**: Dashboard renders a table of all clients with name, Package, Target, Paid, Total Ads, Remaining, and a Payment Status pill — sorted by status priority. Summary strip across the top.

**Independent Test**: Seed 10 clients across all four statuses → open `/dashboard` → see all 10 with correct pills + correct summary totals within 1s.

### Tests for User Story 1

> Domain logic only. UI rendering is "tested by use" via the seed-and-look smoke check.

- [ ] **T027** [P] [US1] Write `tests/unit/status.test.ts` covering the FR-013/FR-014 status state machine: 12 cases for `split-month` × 12 cases for `anchor-day` (3 date positions × 4 paid amounts each) — assert each combo produces the expected status (Cleared / Partial / Pending / Overdue). Run before writing the implementation; should fail with "module not found".
- [ ] **T028** [P] [US1] Write `tests/unit/period.test.ts` covering `buildCurrentPeriod()` for: brand-new client with no prior period, client with one prior closed period (carry-forward applied), zero-target client, paused client. Should fail before T030 lands.

### Domain layer

- [ ] **T029** [US1] Implement `lib/domain/status.ts` exporting `computeStatus({ effectiveTarget, paid, installments, today }): 'cleared' | 'partial' | 'pending' | 'overdue'` — pure function, no DB access. T027 should pass once this lands.
- [ ] **T030** [US1] Implement `lib/domain/period.ts` exporting `buildCurrentPeriod(client, payments, prevClosedPeriod, today)` returning `{ baseTarget, carryForwardFromPrev, effectiveTarget, installments[], paidThisPeriod, remaining, status }`. Handles both billing cycles. T028 should pass once this lands.

### Read-side queries

- [ ] **T031** [US1] Implement `lib/db/queries.ts#fetchRoster()` — single query that returns the active client list with their most-recent closed period AND all payments targeting the current period. Three coordinated queries per [data-model.md Q-001](./data-model.md#q-001-roster-dashboard-main-read).
- [ ] **T032** [US1] Implement `lib/utils/currency.ts#formatEGP(int)` using `Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })`. Add `lib/utils/cn.ts` for the `tailwind-merge` helper.

### UI components

- [ ] **T033** [US1] [P] Build `components/ui/Pill.tsx` — variants for the 4 statuses, mapped to the design tokens from T004. Overdue is solid red; Partial is amber soft; Cleared is muted green ghost; Pending is neutral.
- [ ] **T034** [US1] [P] Build `components/ui/Card.tsx`, `components/ui/Button.tsx` (primary/secondary/ghost/destructive variants), `components/ui/Banner.tsx` (top-of-page banner shell).
- [ ] **T035** [US1] Build `components/dashboard/SummaryStrip.tsx` (Server Component) — renders total clients, total Remaining (formatted EGP), Overdue count, Pending count.
- [ ] **T036** [US1] Build `components/dashboard/StatusPill.tsx` — wrapper around `Pill` that takes a status string and renders the correct variant + label.
- [ ] **T037** [US1] Build `components/dashboard/ClientTable.tsx` (Server Component for now — interactivity arrives in US5) and `components/dashboard/ClientRow.tsx`. Table shows name (RTL-aware cell), Package, Target, Paid, Total Ads, Remaining, Status pill, with default sort: Overdue → Pending → Partial → Cleared, then by name ascending.
- [ ] **T038** [US1] Build `app/(dashboard)/page.tsx` — Server Component that calls `fetchRoster()` then renders `<SummaryStrip />` + `<ClientTable />`.

### Seed

- [ ] **T039** [US1] Write `scripts/seed.ts` that truncates all tables and inserts 10 demo clients per [quickstart.md step 4](./quickstart.md#4-seed-sample-data): 3 Cleared, 3 Partial, 2 Pending, 2 Overdue, plus one anchor-day client and one split-month client with a multi-month carry-forward. Add `npm run seed` script.

**Checkpoint**: Dashboard renders the seeded roster with correct status pills + summary in <1s. The 10-second-scan test from US1 passes manually.

---

## Phase 4: User Story 2 — Add and edit clients + record installment payments (Priority: P1) 🎯 MVP-extending

**Goal**: Manager can add/edit/delete clients and record payments against any installment slot in any period. Status updates automatically. Carry-forward applies on rollover. Prepaid credits work.

**Independent Test**: Add a `split-month` client with Target=5000 → record I1=2500 → status = Partial → record I2=2500 → status = Cleared → record an extra 2500 toward next month → "Credit toward next period" appears in detail view.

### Domain layer

- [ ] **T040** [P] [US2] Write `tests/unit/carry-forward.test.ts` — the 12-month chain test from SC-010-Carry. A `split-month` client paying exactly half each month, a separate `anchor-day` client paying exactly half each period — assert `effectiveTarget` accumulates as expected, to the EGP.
- [ ] **T041** [P] [US2] Write `tests/unit/cycle-edge-cases.test.ts` — anchor day = 28 in February, anchor day in 30- vs 31-day months, mid-period onboarding for anchor-day, switching cycle mid-period.
- [ ] **T042** [US2] Implement `lib/domain/carry-forward.ts` exporting `closePriorPeriod(client, prevPeriod, payments, today)` and `openNewPeriod(client, prevClosedSnapshot, credits, today)`. T040 should pass once these land.

### Mutations (Server Actions)

- [ ] **T043** [US2] Implement `app/actions/clients.ts#createClient` per [contracts/server-actions.md#createclient](./contracts/server-actions.md#createclientinput-actionresult-id-string). Uses the documented zod schema with the `anchor-day-required-iff-anchor-day-cycle` refinement.
- [ ] **T044** [US2] Implement `app/actions/clients.ts#updateClient` and `deleteClient` per [contracts/server-actions.md](./contracts/server-actions.md#updateclientinput-actionresult). Updating `targetCost` mid-period rebalances the current period's installments; updating `billingCycle` or `anchorDay` defers to the next period.
- [ ] **T045** [US2] Implement `app/actions/payments.ts#recordPayment` per [contracts/server-actions.md](./contracts/server-actions.md#recordpaymentinput-actionresult-id-string). Single transaction: insert payment, link to period (or upsert credit), enforce `slot=2 forbidden for anchor-day`.
- [ ] **T046** [US2] Implement `app/actions/payments.ts#editPayment` and `deletePayment`. If the payment was in a closed period, recompute the chain forward.
- [ ] **T047** [US2] Implement `app/api/cron/period-rollover/route.ts` per [contracts/server-actions.md#cron-route](./contracts/server-actions.md#cron-route-appapicronperiod-rolloverroutets). Idempotent. Validates `x-vercel-cron-signature` against `CRON_SECRET`.

### UI

- [ ] **T048** [US2] [P] Build `components/ui/Input.tsx`, `components/ui/Dialog.tsx` (confirm dialog), `components/client/ClientForm.tsx` (shared by new + edit) with `billingCycle` radio + conditional `anchorDay` numeric input.
- [ ] **T049** [US2] Build `app/(dashboard)/clients/new/page.tsx` and `app/(dashboard)/clients/[id]/edit/page.tsx` wrapping `ClientForm` + the create/update server actions.
- [ ] **T050** [US2] Build `app/(dashboard)/clients/[id]/page.tsx` — client detail view. Sections: client header (name + edit + delete), current period card, prior periods list (collapsed by default), payments list, credits list, special services placeholder (filled in US3).
- [ ] **T051** [US2] [P] Build `components/client/PeriodCard.tsx`, `components/client/InstallmentRow.tsx`, `components/client/PaymentForm.tsx` (modal with target-period-month picker + slot selector that hides slot=2 for anchor-day clients), `components/client/PaymentList.tsx`, `components/client/CreditList.tsx`.
- [ ] **T052** [US2] Wire delete-confirmation: clicking Delete opens a `Dialog` that requires the manager to retype the client's name to enable the destructive button.

**Checkpoint**: All 13 acceptance scenarios from US2 in [spec.md](./spec.md) pass when exercised manually.

---

## Phase 5: User Story 3 — Special Services (Priority: P2)

**Goal**: Per-client one-off paid services tracked separately from the package, never rolled into the package Remaining.

**Independent Test**: For an existing client, add 3 services (1 paid, 2 unpaid one >30 days old) → detail view shows them split into Paid/Unpaid groups → "Special Services owed" total = sum of unpaid → dashboard package Remaining is unchanged.

- [ ] **T053** [US3] Implement `app/actions/special-services.ts` exporting `addSpecialService`, `editSpecialService`, `toggleSpecialServicePaid`, `deleteSpecialService` per [contracts/server-actions.md#special-services](./contracts/server-actions.md#special-services-appactionsspecial-servicests).
- [ ] **T054** [US3] [P] Build `components/client/SpecialServiceForm.tsx` (title + description + price + serviceDate + paid checkbox) and `components/client/SpecialServiceList.tsx` (split into "Unpaid" and "Paid" sections, with toggle button per row).
- [ ] **T055** [US3] Wire the Special Services section into `app/(dashboard)/clients/[id]/page.tsx` — replaces the placeholder from T050. Add a "Special Services owed" total banner above the unpaid list.

**Checkpoint**: All 3 acceptance scenarios from US3 in [spec.md](./spec.md) pass.

---

## Phase 6: User Story 4 — Notifications (Priority: P2)

**Goal**: Bell icon with unread badge, notification list, banner when ≥3 Overdue clients. Triggers: newly-overdue, pending-stale (>7d), special-service-unpaid-long (>30d). Notifications are computed-on-read; only read-state is persisted.

**Independent Test**: Seed 2 newly-overdue clients + 1 client pending for 8 days + 1 special service unpaid for 31 days → bell shows badge "4" → notification list contains all 4 with correct reasons → marking one read decreases the badge but keeps the row (low emphasis).

- [ ] **T056** [P] [US4] Write `tests/unit/notifications.test.ts` covering each trigger condition + the resolved-trigger-disappears rule.
- [ ] **T057** [US4] Implement `lib/domain/notifications.ts` exporting `buildNotifications(clients, periods, services, readState, today): Notification[]`. Pure function. T056 should pass once this lands.
- [ ] **T058** [US4] Implement `app/actions/notifications.ts#markNotificationRead` and `markAllNotificationsRead` per [contracts/server-actions.md#notifications](./contracts/server-actions.md#notifications-appactionsnotificationsts).
- [ ] **T059** [US4] [P] Build `components/dashboard/NotificationBell.tsx` (Client Component) — fetches notifications on mount + on window focus (no polling). Badge count = unread.
- [ ] **T060** [US4] [P] Build `components/dashboard/OverdueBanner.tsx` — shown only when ≥3 Overdue clients. One-click filter to show only Overdue.
- [ ] **T061** [US4] Build `app/(dashboard)/notifications/page.tsx` — full list of all notifications grouped by trigger type, with mark-all-read action.
- [ ] **T062** [US4] Wire bell + banner into the dashboard layout (T026). Wire notification clicks to navigate to the relevant client / service.

**Checkpoint**: All 4 acceptance scenarios from US4 in [spec.md](./spec.md) pass. Cron-triggered "newly Overdue" appears within 60 seconds of the cron firing.

---

## Phase 7: User Story 5 — Filter, sort, search (Priority: P3)

**Goal**: Multi-select status filter, sort by any column, name search (debounced 300ms). State survives page refresh.

**Independent Test**: With 30+ clients, check Overdue + Partial → only those visible → click Remaining column → desc sort → type "ahm" in search → only matching rows visible → reload → same view restored.

- [ ] **T063** [US5] [P] Convert `components/dashboard/ClientTable.tsx` from Server to Client Component (or wrap with a client child) to hold filter / sort / search state. Use URL search params as the state mechanism (`useSearchParams` + `router.replace`).
- [ ] **T064** [US5] [P] Build `components/dashboard/StatusFilter.tsx` — multi-checkbox, syncs to URL.
- [ ] **T065** [US5] [P] Build `components/dashboard/SearchBox.tsx` — controlled input with 300ms debounce, syncs to URL.
- [ ] **T066** [US5] Make each `ClientTable` column header sortable (asc/desc toggle); store sort in URL.
- [ ] **T067** [US5] Update the `fetchRoster()` call site to read filter/sort/search from URL params and apply server-side; client-side filtering still runs for instant feedback.

**Checkpoint**: All 4 acceptance scenarios from US5 in [spec.md](./spec.md) pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: a11y, performance, deploy, docs cleanup. Only after every US is independently demoable.

- [ ] **T068** [Polish] [P] Accessibility pass: tab order, focus rings (visible against the cream surface), ARIA labels on the bell + status pills, RTL-aware text alignment within table cells, contrast ratios verified for every status pill against its background.
- [ ] **T069** [Polish] [P] Performance smoke: seed 50 clients, measure dashboard render time (target <1s per SC-008). If slow, profile and add indexes / caching as needed.
- [ ] **T070** [Polish] [P] Production build sanity: `npm run build` clean, no type errors, no console warnings. Run the full smoke checklist from [quickstart.md](./quickstart.md#smoke-test-5-minutes) against the production build locally.
- [ ] **T071** [Polish] Deploy to Vercel: link project, set the four env vars in the dashboard, push to `main`, verify the cron job is registered, run the smoke checklist against the deployed URL.
- [ ] **T072** [Polish] [P] Update root `README.md` (which doesn't exist yet — keep brief; reference [spec.md](./spec.md) and [quickstart.md](./quickstart.md) for details).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no deps.
- **Phase 2 (Foundational)**: depends on Phase 1.
- **Phase 3+ (User Stories)**: each depends on Phase 2. Stories CAN run in parallel by different developers (only one developer here, so they run sequentially in priority order).
- **Phase 8 (Polish)**: depends on all desired stories being done.

### Within each US

- Tests (where included) MUST be written FIRST and confirmed FAIL before implementation.
- Domain layer (`lib/domain/*`) before queries (`lib/db/queries.ts`) before Server Actions (`app/actions/*`) before UI (`components/*` + `app/(dashboard)/*`).
- The seed script (T039) belongs to US1 because every later US needs seeded data to test against.

### Parallel opportunities

Within Phase 1, T003–T011 can run in any order ([P]).
Within Phase 2, T021–T024 (time + auth utilities) are [P].
Within US1, T027 + T028 (tests) are [P]. T033–T034 (UI primitives) are [P].
Within US2, T040 + T041 (tests) are [P]. T048 + T051 (UI primitives + per-client components) are [P].
Within US4, T059 + T060 (bell + banner UI) are [P].
Within US5, T063 + T064 + T065 are [P] (different files).
Within Polish, T068 + T069 + T070 are [P].

---

## Implementation Strategy (recommended)

1. **Day 1**: Phase 1 (Setup) end-to-end. Goal: dev server running, db connected, fonts + tokens visible on a "hello world" page.
2. **Day 2**: Phase 2 (Foundational). Goal: sign-in works, dashboard placeholder loads when authed, all 7 tables exist in Supabase.
3. **Day 3–4**: US1. Goal: seeded dashboard renders correctly with status pills + summary.
4. **Day 5–6**: US2. Goal: full client + payment lifecycle works, including carry-forward and credits. **MVP demo possible here.**
5. **Day 7**: US3. Goal: special services tracked correctly.
6. **Day 8**: US4. Goal: notifications fire and resolve correctly.
7. **Day 9**: US5. Goal: filter/sort/search with URL persistence.
8. **Day 10**: Polish + deploy.

Total estimate: ~10 working days for one developer. Earlier MVP demo possible at end of day 6 (US1 + US2 only).

---

## Notes

- Every task is sized for ~30–90 minutes. If a task balloons past 2 hours, split it.
- Commit after each task or logical group of [P] tasks. Reference the task ID in the commit message: `feat: T029 — implement computeStatus pure function`.
- Stop at every Checkpoint. Verify against the corresponding spec section before moving to the next story.
- If the smoke checklist surfaces a missing requirement, update [spec.md](./spec.md) FIRST, then add follow-up tasks here. Do not silently grow the implementation beyond what the spec covers.
