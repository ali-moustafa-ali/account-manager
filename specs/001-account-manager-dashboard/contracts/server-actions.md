# Server Action Contracts

**Feature**: `001-account-manager-dashboard`
**Date**: 2026-05-05

All mutations in the app are Server Actions exported from files under `app/actions/`. Read paths are direct database queries from React Server Components — they have no contract here. The single non-action route is the cron endpoint.

**Common return shape** (every action):

```ts
type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { field?: string; message: string } };
```

Errors are returned, never thrown across the RSC boundary. The client form maps `error.field` to per-field UI; `error.message` is shown as a form-wide banner if `field` is absent.

**Auth**: every action below calls `requireAuth()` first. An unauthenticated call returns `{ ok: false, error: { message: 'AUTH_REQUIRED' } }` and the client redirects to `/sign-in`.

**Currency convention**: every amount field is `z.number().int().min(0).max(9_999_999)` (whole EGP).

---

## Auth (`app/actions/auth.ts`)

### `signIn(passcode: string): ActionResult`

```ts
const SignInSchema = z.object({
  passcode: z.string().min(4).max(64),
});
```

- Compares `passcode` against `bcrypt.compare(input, env.MANAGER_PASSCODE_HASH)`.
- On success: sets the signed session cookie (HMAC over `{ iat, exp }` with `SESSION_SECRET`, 30-day expiry, `HttpOnly`, `Secure`, `SameSite=Strict`).
- On failure: returns `{ ok: false, error: { field: 'passcode', message: 'INVALID' } }` after a constant-time compare. Rate limit: 5 failed attempts per 5 minutes per IP, returns `{ message: 'RATE_LIMITED' }` thereafter.

### `signOut(): ActionResult`

- Clears the session cookie. Always returns `{ ok: true }`.

---

## Clients (`app/actions/clients.ts`)

### `createClient(input): ActionResult<{ id: string }>`

```ts
const CreateClientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  packageCost: z.number().int().min(0).max(9_999_999),
  targetCost: z.number().int().min(0).max(9_999_999),
  totalAdsAmount: z.number().int().min(0).max(9_999_999).default(0),
  onboardedOn: z.string().date().optional(), // ISO YYYY-MM-DD; defaults to today (Cairo)
  billingCycle: z.enum(['split-month', 'anchor-day']).default('split-month'),
  anchorDay: z.number().int().min(1).max(28).optional(),
}).refine(
  (v) => (v.billingCycle === 'anchor-day') === (v.anchorDay !== undefined),
  {
    message: 'anchorDay is required when billingCycle is "anchor-day", and forbidden otherwise',
    path: ['anchorDay'],
  },
);
```

- Inserts into `clients`. Does NOT materialize the first period — that happens lazily on first dashboard read for the current period, then by cron for subsequent periods.
- Returns the new client's `id` so the form can redirect to its detail page.

### `updateClient(input): ActionResult`

```ts
const UpdateClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  packageCost: z.number().int().min(0).max(9_999_999).optional(),
  targetCost: z.number().int().min(0).max(9_999_999).optional(),
  totalAdsAmount: z.number().int().min(0).max(9_999_999).optional(),
  status: z.enum(['active', 'paused']).optional(),
  billingCycle: z.enum(['split-month', 'anchor-day']).optional(),
  anchorDay: z.number().int().min(1).max(28).nullable().optional(),
}).refine(/* same anchor-day-required-iff-anchor-day-cycle invariant as createClient */);
```

- All fields optional; at least one must be present (`refine`).
- If `targetCost` changes mid-period: re-derives the current period's `effective_target` and re-creates its installments. Already-recorded payments are preserved unchanged.
- If `billingCycle` or `anchorDay` changes: the change applies to the **next** period only. The current period keeps its installments (FR-008's "no retroactive reshape" rule).

### `deleteClient(input): ActionResult`

```ts
const DeleteClientSchema = z.object({
  id: z.string().uuid(),
  confirmName: z.string(), // must match client.name exactly — typed by manager in confirm dialog
});
```

- Hard delete with cascade. Returns `{ ok: false, error: { field: 'confirmName', message: 'NAME_MISMATCH' } }` if `confirmName !== client.name`.

---

## Payments (`app/actions/payments.ts`)

### `recordPayment(input): ActionResult<{ id: string }>`

```ts
const RecordPaymentSchema = z.object({
  clientId: z.string().uuid(),
  targetYear: z.number().int().min(2024).max(2100),
  targetMonth: z.number().int().min(1).max(12),
  slot: z.union([z.literal(1), z.literal(2), z.literal('credit')]),
  amount: z.number().int().min(1).max(9_999_999),
  receivedOn: z.string().date(),
  note: z.string().max(500).optional(),
});
```

- Records a payment in a single transaction:
  1. Resolve the client's `billingCycle`. Reject with `{ field: 'slot', message: 'INVALID_SLOT_FOR_CYCLE' }` if the client is `anchor-day` and `slot = 2`.
  2. Insert into `payments`.
  3. If the target period exists and `slot ∈ {1, 2}` → set `payments.period_id` to it.
  4. If the target period is in the future (not yet materialized) → insert/update the `credits` row.
  5. Return the new payment's `id`.
- Idempotent against accidental double-submits: the form sends a client-generated `idempotencyKey` (out of zod schema for now; can be added if double-submits become a real issue).

### `editPayment(input): ActionResult`

```ts
const EditPaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int().min(1).max(9_999_999).optional(),
  slot: z.union([z.literal(1), z.literal(2), z.literal('credit')]).optional(),
  receivedOn: z.string().date().optional(),
  note: z.string().max(500).nullable().optional(),
});
```

- Re-runs the credit recomputation in the same transaction.
- Allowed on payments belonging to closed periods — recomputes `closed_unpaid` and propagates the chain forward (warning shown in UI before the manager confirms).

### `deletePayment(input): ActionResult`

```ts
const DeletePaymentSchema = z.object({
  id: z.string().uuid(),
});
```

- Hard delete. Same chain-propagation as `editPayment` if the payment belonged to a closed period.

---

## Special Services (`app/actions/special-services.ts`)

### `addSpecialService(input): ActionResult<{ id: string }>`

```ts
const AddSpecialServiceSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional(),
  price: z.number().int().min(0).max(9_999_999),
  serviceDate: z.string().date(),
  paid: z.boolean().default(false),
});
```

### `editSpecialService(input): ActionResult`

```ts
const EditSpecialServiceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().int().min(0).max(9_999_999).optional(),
  serviceDate: z.string().date().optional(),
});
```

### `toggleSpecialServicePaid(input): ActionResult`

```ts
const TogglePaidSchema = z.object({
  id: z.string().uuid(),
  paid: z.boolean(),
});
```

- Sets `paid_on = currentDateCairo()` when `paid` becomes true, clears it when `paid` becomes false.

### `deleteSpecialService(input): ActionResult`

```ts
const DeleteSpecialServiceSchema = z.object({
  id: z.string().uuid(),
});
```

---

## Notifications (`app/actions/notifications.ts`)

### `markNotificationRead(input): ActionResult`

```ts
const MarkReadSchema = z.object({
  notificationKey: z.string().min(1).max(128),
});
```

- Upserts into `notification_read_state` with `(notificationKey, now())`.

### `markAllNotificationsRead(input): ActionResult`

```ts
const MarkAllReadSchema = z.object({
  keys: z.array(z.string().min(1).max(128)).max(500),
});
```

- Bulk upsert. Capped at 500 to avoid pathological payloads.

---

## Cron route (`app/api/cron/period-rollover/route.ts`)

This is the **only HTTP route** in the app — everything else is a Server Action.

### `POST /api/cron/period-rollover`

**Auth**: header `x-vercel-cron-signature` validated against `CRON_SECRET` env var.

**Behavior** (idempotent — safe to retry):
1. Compute `today = nowInCairo()`.
2. For each `clients` row where `status = 'active'`:
   a. Determine if today is a rollover day for THIS client:
      - `split-month`: rollover when `today.day == 1`.
      - `anchor-day`: rollover when `today.day == client.anchor_day`.
   b. If today is NOT a rollover day for the client → skip.
   c. Compute the closing period's `(year, month)`:
      - `split-month`: previous calendar month.
      - `anchor-day`: the period whose `period_start_date` was `today − 1 month` (with anchor day = `client.anchor_day`).
   d. Close the prior period:
      - If `periods` row exists for `(client, closingYear, closingMonth)` and `closed_at` is null → set `closed_at = now()`, `closed_unpaid = max(0, effective_target − sumOfPayments)`.
      - Else (period was never materialized — first-rollover case) → compute `closed_unpaid` on the fly and create the prior `periods` row in closed state.
   e. Open the new period:
      - Insert `periods` row for `(client, today.year, today.month)` with `base_target = client.target_cost`, `carry_forward_from_prev = priorPeriod.closed_unpaid`, `effective_target = sum`, `cycle_snapshot = client.billing_cycle`, `anchor_day_snapshot = client.anchor_day` (or null), `period_start_date = today`, `period_end_date = computed from cycle`.
      - Insert installment(s) for the new period — 2 for split-month, 1 for anchor-day.
   f. Apply credits: SELECT `credits` row for `(client, today.year, today.month)`. If exists → UPDATE its amount to 0 (we keep the row for audit) AND insert a `payments` row representing the credit application.
3. Cleanup: DELETE `notification_read_state` rows whose key references a trigger that no longer fires.
4. Return `{ rolledOver: number, clientsProcessed: number, errors: [] }`.

**Error handling**: per-client errors are caught and logged; the cron continues for the rest. Returns 200 with the error list. A non-empty error list causes a follow-up alert (email/log — TBD) but does not block the response.

**Why daily, not first-of-month**: with anchor-day clients, rollover can happen on ANY day of the month (depending on each client's anchor). Running the cron daily lets each client roll over on the right day. Clients with no rollover today are skipped quickly in step 2b.
