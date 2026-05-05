# Data Model: Account Manager Dashboard

**Feature**: `001-account-manager-dashboard`
**Date**: 2026-05-05
**Storage**: Postgres (Neon serverless) via Drizzle ORM
**Currency convention**: All amounts are integer EGP. There is no `decimal`, no `numeric`, no `float` anywhere in the schema.
**Date convention**: Calendar dates are `date` (Postgres `DATE`, ISO `YYYY-MM-DD`). Timestamps for system events are `timestamptz` (UTC, displayed in Africa/Cairo).

---

## Entity-Relationship Overview

```text
┌──────────┐        ┌──────────┐         ┌──────────────┐
│ clients  │───<┬───│ periods  │────<────│ installments │  (always exactly 2 per period
│          │   1│   │          │   1   2 │              │   when client.targetCost > 0)
└──────────┘    │   └──────────┘         └──────────────┘
                │        │
                │        ├──────<────────┐
                │        │               │
                │   ┌──────────┐    ┌──────────┐
                │   │ payments │    │ credits  │
                │   └──────────┘    └──────────┘
                │
                ├──────<────────┐
                │               │
                │   ┌──────────────────┐
                └───│ special_services │
                    └──────────────────┘

┌─────────────────────────┐
│ notification_read_state │   (singleton-user, no FK to a user table)
└─────────────────────────┘
```

Legend: `1` = one, `<` = many. Cascading deletes flow from `clients` → `periods` → `installments`/`payments`, and `clients` → `credits` / `special_services`.

---

## Tables

### `clients`

The agency's customer roster.

| Column              | Type                | Constraints                                | Notes |
|---------------------|---------------------|--------------------------------------------|-------|
| `id`                | `uuid`              | `primary key default gen_random_uuid()`    |       |
| `name`              | `varchar(80)`       | `not null check (length(name) > 0)`        | Arabic or Latin script. |
| `package_cost`      | `integer`           | `not null check (package_cost >= 0)`       | Full contract value, EGP. Informational; not used in status math when `target_cost > 0`. |
| `target_cost`       | `integer`           | `not null check (target_cost >= 0)`        | Recurring per period, EGP. `0` = one-off project (no installment cycle). |
| `total_ads_amount`  | `integer`           | `not null default 0 check (total_ads_amount >= 0)` | Lifetime cumulative ad spend the client has paid in. Displayed on dashboard, not used in status math. |
| `billing_cycle`     | `billing_cycle`     | `not null default 'split-month'`           | enum: `split-month` \| `anchor-day`. Determines period shape and installment schedule. |
| `anchor_day`        | `smallint`          | `null check (anchor_day is null or (anchor_day between 1 and 28))` | Required when `billing_cycle = 'anchor-day'`; must be NULL otherwise. Capped at 28 to keep day arithmetic safe in February. App-level check in addition to the column check. |
| `status`            | `client_status`     | `not null default 'active'`                | enum: `active` \| `paused`. Paused clients skip period rollover and Overdue counts. |
| `onboarded_on`      | `date`              | `not null default current_date`            | Used to compute the first period's installment due date when onboarded mid-period. |
| `created_at`        | `timestamptz`       | `not null default now()`                   |       |
| `updated_at`        | `timestamptz`       | `not null default now()`                   | Bumped via trigger on UPDATE. |

**Indexes**:
- `clients_status_idx` on `(status)` — used by roster query to filter active/paused.
- `clients_billing_cycle_idx` on `(billing_cycle)` — minor; lets the rollover cron iterate split-month vs anchor-day clients separately if helpful.

**Drizzle excerpt**:
```ts
export const clientStatusEnum = pgEnum('client_status', ['active', 'paused']);
export const billingCycleEnum = pgEnum('billing_cycle', ['split-month', 'anchor-day']);

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 80 }).notNull(),
  packageCost: integer('package_cost').notNull(),
  targetCost: integer('target_cost').notNull(),
  totalAdsAmount: integer('total_ads_amount').notNull().default(0),
  billingCycle: billingCycleEnum('billing_cycle').notNull().default('split-month'),
  anchorDay: smallint('anchor_day'), // 1-28, only when billingCycle = 'anchor-day'
  status: clientStatusEnum('status').notNull().default('active'),
  onboardedOn: date('onboarded_on').notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index('clients_status_idx').on(t.status),
  billingCycleIdx: index('clients_billing_cycle_idx').on(t.billingCycle),
  anchorDayCheck: check('clients_anchor_day_chk',
    sql`(${t.billingCycle} = 'split-month' AND ${t.anchorDay} IS NULL)
        OR (${t.billingCycle} = 'anchor-day' AND ${t.anchorDay} BETWEEN 1 AND 28)`),
}));
```

---

### `periods`

A materialized billing cycle for a client. Created by the rollover cron (or lazily on first read of a brand-new period). The current period's row may not exist yet for a client whose first period hasn't rolled over — in that case the dashboard derives the current state on-the-fly. Closed periods are immutable except for `closed_at` being set.

The shape of a period depends on the parent client's `billing_cycle`:
- For `split-month`: the period's `period_start_date` is day 1 of (year, month). `period_end_date` is the last day of (year, month). The `(year, month)` columns redundantly encode this for index-friendly queries.
- For `anchor-day`: `period_start_date` = day `client.anchor_day` of (year, month). `period_end_date` = day `client.anchor_day − 1` of (year, month + 1). The `(year, month)` columns hold the START year/month for clean dashboard joins.

| Column                    | Type           | Constraints                                  | Notes |
|---------------------------|----------------|----------------------------------------------|-------|
| `id`                      | `uuid`         | `primary key default gen_random_uuid()`      |       |
| `client_id`               | `uuid`         | `not null references clients(id) on delete cascade` |       |
| `year`                    | `integer`      | `not null check (year between 2024 and 2100)` | Year of the period's START date. |
| `month`                   | `integer`      | `not null check (month between 1 and 12)`    | Month of the period's START date. |
| `period_start_date`       | `date`         | `not null`                                   | Inclusive. Day 1 for split-month; `anchor_day` for anchor-day. |
| `period_end_date`         | `date`         | `not null check (period_end_date >= period_start_date)` | Inclusive. Last day of month for split-month; `anchor_day − 1` of next month for anchor-day. |
| `base_target`             | `integer`      | `not null check (base_target >= 0)`          | The client's `target_cost` snapshot at the time the period opened. |
| `carry_forward_from_prev` | `integer`      | `not null default 0 check (carry_forward_from_prev >= 0)` | Unpaid amount carried in from the prior period. |
| `effective_target`        | `integer`      | `not null check (effective_target >= 0)`     | = `base_target + carry_forward_from_prev`. Stored (not derived) so that future schema changes don't silently rewrite history. |
| `cycle_snapshot`          | `billing_cycle`| `not null`                                   | Snapshot of `client.billing_cycle` at period open. Lets us render historical periods correctly even if the client's cycle was changed since. |
| `anchor_day_snapshot`     | `smallint`     | `null`                                       | Snapshot of `client.anchor_day` at period open (only when `cycle_snapshot = 'anchor-day'`). |
| `closed_at`               | `timestamptz`  | `null` (set when rollover finalizes the period) | When non-null, the period is closed and no further payments may be allocated to it (corrections still possible via explicit edit). |
| `closed_unpaid`           | `integer`      | `null` — set when `closed_at` is set         | Snapshot of `effective_target − sumOfPaymentsForThisPeriod` at close. This is the value that becomes the next period's `carry_forward_from_prev`. |
| `created_at`              | `timestamptz`  | `not null default now()`                     |       |

**Indexes**:
- `periods_client_year_month_uq` UNIQUE on `(client_id, year, month)` — exactly one period row per client per (start) year+month.
- `periods_client_id_idx` on `(client_id)` — for detail-view fetches.
- `periods_start_date_idx` on `(period_start_date)` — for cron iteration.

**Drizzle excerpt**:
```ts
export const periods = pgTable('periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  baseTarget: integer('base_target').notNull(),
  carryForwardFromPrev: integer('carry_forward_from_prev').notNull().default(0),
  effectiveTarget: integer('effective_target').notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedUnpaid: integer('closed_unpaid'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  clientYearMonthUq: uniqueIndex('periods_client_year_month_uq').on(t.clientId, t.year, t.month),
  clientIdx: index('periods_client_id_idx').on(t.clientId),
}));
```

---

### `installments`

The number of rows per `periods` row depends on the period's `cycle_snapshot`:
- `split-month` and `effective_target > 0` → exactly **2** rows (slots 1 and 2).
- `anchor-day` and `effective_target > 0` → exactly **1** row (slot 1).
- `effective_target = 0` (paused / zero-target client) → **0** rows.

| Column            | Type        | Constraints                                | Notes |
|-------------------|-------------|--------------------------------------------|-------|
| `id`              | `uuid`      | `primary key default gen_random_uuid()`    |       |
| `period_id`       | `uuid`      | `not null references periods(id) on delete cascade` |       |
| `slot`            | `smallint`  | `not null check (slot in (1, 2))`          | For anchor-day periods, only `1` is valid. |
| `expected_amount` | `integer`   | `not null check (expected_amount >= 0)`    | split-month/slot=1: `floor(effectiveTarget/2)`. split-month/slot=2: `effectiveTarget − slot1`. anchor-day/slot=1: `effectiveTarget`. |
| `due_date`        | `date`      | `not null`                                 | split-month/slot=1: `period_start_date` (day 1 or onboarding day). split-month/slot=2: `lastDayOfMonth − 5`. anchor-day/slot=1: `period_start_date` (anchor day or onboarding day). |

**Indexes**:
- `installments_period_slot_uq` UNIQUE on `(period_id, slot)` — enforces no duplicate slots within a period.
- `installments_due_date_idx` on `(due_date)` — for "any installment overdue today?" queries.

---

### `payments`

A single recorded inflow from a client. The unit of action for the manager.

| Column         | Type        | Constraints                                | Notes |
|----------------|-------------|--------------------------------------------|-------|
| `id`           | `uuid`      | `primary key default gen_random_uuid()`    |       |
| `client_id`    | `uuid`      | `not null references clients(id) on delete cascade` |       |
| `period_id`    | `uuid`      | `null references periods(id) on delete set null` | Null when allocated to a future period that hasn't been materialized yet — see `target_year`/`target_month`. |
| `target_year`  | `integer`   | `not null check (target_year between 2024 and 2100)` | The period this payment is *intended* for. |
| `target_month` | `integer`   | `not null check (target_month between 1 and 12)`     |       |
| `slot`         | `smallint`  | `null check (slot is null or slot in (1, 2))` | If null = "credit" (advance payment not yet pinned to a slot). Set to 1 or 2 when the payment is allocated to a specific installment. |
| `amount`       | `integer`   | `not null check (amount > 0)`              | EGP. Always positive — refunds are recorded as a negative `payments` row only if needed (out of v1 scope). |
| `received_on`  | `date`      | `not null default current_date`            | The day the manager received the money. |
| `note`         | `text`      | `null`                                     | Free-text. |
| `created_at`   | `timestamptz` | `not null default now()`                 |       |

**Indexes**:
- `payments_client_target_idx` on `(client_id, target_year, target_month)` — primary read pattern.
- `payments_period_id_idx` on `(period_id)` where not null.

**Why no FK from `payments` to `installments`**: A payment can target a future month whose `installments` rows don't exist yet. Storing `target_year`/`target_month`/`slot` denormalized lets the manager record advance payments without forcing the system to materialize future periods.

---

### `credits`

A read-optimized projection of "advance payments not yet rolled into a period". A row exists per `(client_id, target_year, target_month)` summing all payments that target a future, not-yet-materialized period. Recomputed on every payment write (and on rollover). Conceptually a materialized view; we model it as a table for query simplicity.

| Column         | Type      | Constraints                                | Notes |
|----------------|-----------|--------------------------------------------|-------|
| `client_id`    | `uuid`    | `not null references clients(id) on delete cascade` |       |
| `target_year`  | `integer` | `not null`                                 |       |
| `target_month` | `integer` | `not null`                                 |       |
| `amount`       | `integer` | `not null check (amount >= 0)`             | Sum of payments for this future period. Recomputed in the same transaction as any payment mutation. |
| **PK**         |           | `(client_id, target_year, target_month)`   |       |

**Note**: An alternative is to compute this on-the-fly in queries. Materializing it as a table makes the rollover handler trivially correct (read one row per (client, nextMonth), apply, delete) and the dashboard summary fast.

---

### `special_services`

One-off paid services delivered to a client, separate from the package cycle.

| Column        | Type           | Constraints                                | Notes |
|---------------|----------------|--------------------------------------------|-------|
| `id`          | `uuid`         | `primary key default gen_random_uuid()`    |       |
| `client_id`   | `uuid`         | `not null references clients(id) on delete cascade` |       |
| `title`       | `varchar(120)` | `not null check (length(title) > 0)`       |       |
| `description` | `text`         | `null check (length(description) <= 1000)` |       |
| `price`       | `integer`      | `not null check (price >= 0)`              | EGP. |
| `service_date`| `date`         | `not null default current_date`            |       |
| `paid`        | `boolean`      | `not null default false`                   |       |
| `paid_on`     | `date`         | `null`                                     | Set when `paid` toggles true; cleared when toggled false. |
| `created_at`  | `timestamptz`  | `not null default now()`                   |       |
| `updated_at`  | `timestamptz`  | `not null default now()`                   |       |

**Indexes**:
- `special_services_client_idx` on `(client_id)`.
- `special_services_unpaid_age_idx` on `(paid, service_date)` partial `where paid = false` — used by the "unpaid > 30 days" notification trigger.

---

### `notification_read_state`

Persists which derived notifications the manager has acknowledged. Notifications themselves are computed on-read; this table only tracks read/unread.

| Column          | Type           | Constraints                                | Notes |
|-----------------|----------------|--------------------------------------------|-------|
| `notification_key` | `varchar(128)` | `primary key`                          | Stable hash: `${triggerType}:${clientId}:${optionalServiceId ?? ''}:${fireDate}`. |
| `read_at`       | `timestamptz`  | `not null default now()`                   |       |

**Notes**:
- Single-user app — no `manager_id` column needed. If multi-user is added in v2, this table grows a `manager_id` and the PK becomes composite.
- Rows for resolved triggers can be cleaned up in the rollover handler (compute the current trigger key set, delete read-state for keys no longer in the set).

---

## Schema-level invariants

These invariants are enforced by a mix of column constraints, unique indexes, and application-level transactions:

1. **Exactly one period per (client, year, month)** — enforced by `periods_client_year_month_uq`.
2. **Installment count per period matches cycle_snapshot** — application-enforced in the `materializePeriod()` transaction:
   - `cycle_snapshot = 'split-month'` AND `effective_target > 0` → 2 installments (slots 1 and 2).
   - `cycle_snapshot = 'anchor-day'` AND `effective_target > 0` → 1 installment (slot 1).
   - `effective_target = 0` → 0 installments.
3. **Sum of installment.expected_amount per period = period.effective_target** — application-enforced.
4. **`anchor_day` is set iff `billing_cycle = 'anchor-day'`** — enforced at the column level via `clients_anchor_day_chk`.
5. **`anchor_day_snapshot` is set iff `cycle_snapshot = 'anchor-day'`** — application-enforced in the rollover handler.
6. **`closed_at` set ⇒ `closed_unpaid` set** — application-enforced in the rollover handler.
7. **Payment amounts always positive** — `check (amount > 0)` at column level.
8. **No payment may be allocated to a closed period via `period_id`** — application-enforced; corrections on closed periods go through an explicit "edit closed period" flow that bumps the carry-forward chain.
9. **Payment slot must match the target period's cycle** — for anchor-day target periods, only `slot = 1` is valid; for split-month, `slot ∈ {1, 2, 'credit'}`. Application-enforced in `recordPayment` / `editPayment`.

---

## Migration plan

Single initial migration (`0001_init.sql`) generated from the Drizzle schema. Adds:
1. `client_status` enum
2. All seven tables in dependency order: `clients` → `periods` → `installments`, `clients` → `payments`, `clients` → `credits`, `clients` → `special_services`, `notification_read_state`
3. All indexes listed above
4. An `updated_at` trigger function applied to `clients` and `special_services`

No seed data in the migration. Seed data lives in `scripts/seed.ts` and is opt-in (run once, locally, against an empty DB).

---

## Read-side query shapes

Documented here so they're considered during schema design, not after.

### Q-001: Roster (dashboard main read)

For each active client:
1. Fetch `clients` (filtered to `status = 'active'`).
2. For each, derive the current period's state:
   - If a `periods` row exists for `(client.id, currentYear, currentMonth)` → use it.
   - Else compute `effective_target` on the fly: `client.target_cost + (mostRecentClosedPeriod?.closed_unpaid ?? 0)`.
3. Sum payments for the current period: `sum(amount) where client_id = ? and target_year = ? and target_month = ?`.
4. Compute status from `(effective_target, sumPaid, today, installmentDueDates)`.
5. Compute `remaining = max(0, effective_target − sumPaid)`.

This is one query for the clients list + one query for current-period payments grouped by client + one query for the most-recent-closed-period per client. All three are served by indexes above.

### Q-002: Client detail (per-client view)

1. Fetch the client.
2. Fetch all `periods` for this client (lifetime), with their installments, payments, and `credits` rows.
3. Fetch all `special_services` for this client, partitioned by `paid`.

### Q-003: Notifications (computed on-read)

1. Fetch all active clients with current-period status (Q-001 reused).
2. For each Overdue client → emit `newly-overdue` notification (if not in read-state) or `overdue-acknowledged` (if in read-state).
3. For each client whose status has been Pending and `today − periodStart > 7` → emit `pending-stale`.
4. For each unpaid `special_services` row where `today − service_date > 30` → emit `special-service-unpaid-long`.
5. Look up read-state for each computed notification key.

---

## Open data-model questions (none blocking implementation)

- **Refunds / negative payments** — out of v1 scope. If needed in v2, allow `payments.amount < 0` and treat appropriately in sums.
- **Multi-currency** — out of scope. If introduced, every amount column gains a sibling `currency` column and EGP becomes the default.
- **Soft delete for clients** — out of v1 scope. Hard delete with cascade is the v1 behavior; the confirm dialog warns the manager.
- **Audit trail** — out of v1 scope (per the spec's remaining `[NEEDS CLARIFICATION]`). If added, append a `changelog` table with `(entityType, entityId, field, oldValue, newValue, changedAt)`.
