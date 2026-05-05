# Feature Specification: Account Manager Dashboard (Marketing Agency)

**Feature Branch**: `001-account-manager-dashboard`
**Created**: 2026-05-05
**Status**: Draft
**Input**: User description: "ماركت اجينسي اعمل نظام، شغال اكونت مانجير اعمل لي داش بورد Next.js 16 — اسم العميل، Package Cost EGP، Target Cost (المفروض يدفعه الشهر لو وافق على الباقة أو قرر يكمل)، Paid (اللي دفعه)، Total Ads Amount (اللي دفعه علشان الإعلانات)، جزء لتسجيل Special Services، Payment Status (Cleared / Partial / Pending / Overdue)، جزء لل Remaining، مع notifications. التصميم على نمط https://impeccable.style/."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Account manager sees the full client roster at a glance (Priority: P1) 🎯 MVP

As an account manager at a marketing agency, when I open the dashboard I see every client I'm responsible for in one table: their name, monthly target, what they've paid this period, what's still owed (Remaining), and a colored Payment Status pill (Cleared / Partial / Pending / Overdue). I can scan the page in under 10 seconds and immediately see which 2–3 clients need a follow-up call today.

**Why this priority**: This single view is the entire reason the dashboard exists. Without it, the account manager is back to chasing payments through scattered WhatsApp messages and a spreadsheet. Everything else (adding clients, recording special services, notifications) depends on this list rendering correctly. It's also independently demoable with seeded data — no payment-recording flow needed.

**Independent Test**: Seed the database with 10 sample clients across all four payment statuses and varying Remaining amounts. Open the dashboard. Verify the manager can identify, within 10 seconds, which clients are Overdue and what the total Remaining across the roster is.

**Acceptance Scenarios**:

1. **Given** 10 seeded clients with mixed statuses, **When** the manager opens `/dashboard`, **Then** all 10 rows render with name, Package Cost, Target Cost, Paid, Total Ads Amount, Remaining, and a colored Payment Status pill.
2. **Given** the dashboard is loaded, **When** the manager looks at the header, **Then** a summary strip shows: total clients, total Remaining across all clients (EGP), count of Overdue clients, count of Pending clients.
3. **Given** the dashboard is loaded, **When** the manager clicks a client row, **Then** they navigate to that client's detail page (or open a side panel) showing their full payment + special-services history.
4. **Given** the dashboard contains an Overdue client, **When** the row renders, **Then** the Overdue pill uses the highest-emphasis status color and the row is sorted ahead of non-Overdue rows by default.

---

### User Story 2 — Account manager adds clients and records 50/50 installment payments (Priority: P1) 🎯 MVP-extending

The account manager can add a new client by entering: name, Package Cost (EGP), and Target Cost (the recurring monthly amount the client should pay if they continue). For every active month, the system expects **two equal installments** of `Target/2` — the **first half** at the start of the month and the **second half** 5 days before month-end. The manager records each payment as it arrives, and the dashboard's Paid / Remaining / Status update automatically. A client who wants to continue may prepay the next month's first half together with the current month's second half.

**Why this priority**: Without the ability to add clients and record installment payments, the dashboard is a static demo. The 50/50 cycle is the actual business reality, so the MVP must support it from day one.

**Independent Test**: From an empty dashboard, add a client with Target = 5000 and watch status flow Pending → Partial → Cleared as the manager records the first half, then the second half. Then in the same client, record an additional 2500 toward "next month, first half" and verify it's stored as a credit and surfaces on the next period rollover, not as part of the current month's Paid.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** the manager clicks "Add client" and submits `{name: "Acme Co", PackageCost: 60000, TargetCost: 5000}`, **Then** Acme appears in the table with Paid = 0, Remaining = 5000, status = Pending, and the detail view shows two installments scheduled (Installment 1 due day 1 of this month, Installment 2 due day `lastOfMonth − 5`).
2. **Given** Acme has Target = 5000 and zero paid, **When** the manager records a payment of 2500 against Installment 1, **Then** dashboard Paid = 2500, Remaining = 2500, status = Partial.
3. **Given** Acme's Installment 1 is paid and the month-end is more than 5 days away, **When** the dashboard renders, **Then** status remains Partial (not Overdue).
4. **Given** today is `lastOfMonth − 4` and only Installment 1 is paid, **When** the dashboard renders, **Then** status flips to Overdue because Installment 2's due date has passed.
5. **Given** Acme has both installments paid (Paid = 5000 = Target), **When** the row renders, **Then** Remaining = 0 and status = Cleared.
6. **Given** Acme is fully paid for this month, **When** the manager records an additional 2500 marked as "Next period, Installment 1", **Then** the current month's Paid stays at 5000 (still Cleared), and the detail view shows a "Credit toward next period: 2500 EGP" line.
7. **Given** the next calendar month begins and Acme had a 2500 prepaid credit, **When** the dashboard loads on day 1 of the new month, **Then** Acme's new-period Paid starts at 2500 (Installment 1 marked as already paid from the credit) and status = Partial (not Pending).
8. **Given** Acme closed last month with Target = 5000, Paid = 3000 (so Unpaid = 2000), **When** the new month begins, **Then** Acme's new-period effectiveTarget = 5000 + 2000 = 7000, Installment 1 = 3500, Installment 2 = 3500, dashboard shows Target column = 7000, detail view breaks it down as "Base 5000 + Carry-forward 2000".
9. **Given** Acme has both a 2000 carry-forward AND a 1500 prepaid credit going into the new month, **When** the new period begins, **Then** effectiveTarget = 5000 + 2000 = 7000, starting Paid = 1500, Remaining = 5500, status = Partial.
10. **Given** the manager adds a new client "Beta Corp" with `billingCycle = 'anchor-day'`, `anchorDay = 5`, `Target = 8000`, on May 12, **Then** Beta's first period runs May 12 → June 4 with a single installment of 8000 due May 12. Beta's June period runs June 5 → July 4 with a single installment of 8000 due June 5.
11. **Given** Beta (anchor-day, anchor=5) closes May with Paid = 5000 (Unpaid = 3000), **When** the June period begins on June 5, **Then** Beta's June effectiveTarget = 8000 + 3000 = 11,000, single installment = 11,000 due June 5.
12. **Given** Acme is on `split-month`, **When** the manager edits Acme to `anchor-day` with `anchorDay = 10` mid-period, **Then** Acme's current period keeps its 2 installments (no retroactive change), and the next period (starting day 10 of next month) follows the anchor-day pattern.
13. **Given** any client, **When** the manager opens its detail view and clicks "Delete", **Then** they are asked to confirm, and on confirm the client and all associated records (special services, payments, credits, carry-forward history) are removed.

---

### User Story 3 — Account manager records Special Services per client (Priority: P2)

Beyond the monthly package, the manager records ad-hoc Special Services they delivered to a client (e.g. logo redesign, video edit, extra landing page). Each Special Service is a separate line item with: title, description, price (EGP), date, and a paid/unpaid flag. Special Services do **not** roll up into the package Target — they are tracked separately so the manager can invoice them individually.

**Why this priority**: Special Services are how the agency captures revenue beyond retainer packages. Important for revenue visibility, but not on the critical path for the MVP — the manager can survive a week without it by noting them in WhatsApp.

**Independent Test**: For an existing client, add 3 Special Services (one paid, two unpaid). Verify the client detail page shows them in a separate section and the unpaid total appears as a "Special Services owed" line distinct from the package Remaining.

**Acceptance Scenarios**:

1. **Given** an existing client, **When** the manager adds a Special Service {title: "Logo redesign", price: 1500, date: 2026-05-04, paid: false}, **Then** it appears in the client's Special Services section as unpaid and contributes 1500 EGP to a separate "Special Services owed" total.
2. **Given** an unpaid Special Service, **When** the manager toggles it to paid, **Then** the "Special Services owed" total decreases by that price and the line is visibly marked paid (not deleted).
3. **Given** a client has 2 unpaid Special Services totalling 3000 EGP and a package Remaining of 2500 EGP, **When** the dashboard renders, **Then** the row shows package Remaining = 2500 separately from any indication that Special Services are owed (the two are NOT summed into one number).

---

### User Story 4 — Account manager gets notified about Overdue and Pending clients (Priority: P2)

The dashboard surfaces a notification center (a bell icon with a badge count) that shows actionable alerts: clients whose payment is now Overdue, clients whose Pending status has lasted more than 7 days, and Special Services that have been unpaid for more than 30 days. Clicking a notification jumps the manager to that client's row or detail view. Notifications also appear inline as a top-of-page banner if there are 3+ Overdue clients.

**Why this priority**: Notifications are what convert the dashboard from "a passive list" into "a tool that pulls the manager toward action". They depend on US1 (the data model) and US2 (status transitions) being in place.

**Independent Test**: Seed the database with clients whose due dates fall on yesterday (Overdue) and today (Pending). Open the dashboard. Verify the bell badge shows the correct count, the notification list contains the right clients with the right reason, and clicking a notification navigates correctly.

**Acceptance Scenarios**:

1. **Given** 2 clients went Overdue overnight, **When** the manager opens the dashboard, **Then** the bell shows a "2" badge and the notification list lists both clients with reason "Payment overdue since [date]".
2. **Given** the manager clicks a notification, **When** the action fires, **Then** the dashboard scrolls to and highlights that client's row (or opens their detail view).
3. **Given** there are 3 or more Overdue clients, **When** the dashboard loads, **Then** a top-of-page banner appears summarizing "X clients are overdue — review now" with a link to filter the table to just Overdue.
4. **Given** the manager has read a notification, **When** they reload, **Then** the unread count decreases but the notification remains in the list (read state, lower visual emphasis) until the underlying status is no longer Overdue.

---

### User Story 5 — Account manager filters and sorts the roster (Priority: P3)

The manager can filter the dashboard by Payment Status (multi-select among Cleared / Partial / Pending / Overdue) and sort by any column (name, Remaining, Target, Paid, Total Ads Amount). A search box filters the visible rows by client name as the manager types.

**Why this priority**: Quality-of-life. Once the agency has 30+ clients the unfiltered table becomes unwieldy. P3 because the MVP works fine with a sortable but unfiltered table for the first 10–20 clients.

**Independent Test**: With 30+ seeded clients, the manager filters to just Overdue + Partial, then sorts by Remaining descending. The visible list updates without a full page reload and the result correctly reflects both filter and sort.

**Acceptance Scenarios**:

1. **Given** 30+ clients of mixed status, **When** the manager checks "Overdue" and "Partial" in the status filter, **Then** the table updates to show only those two groups.
2. **Given** any filtered view, **When** the manager clicks the "Remaining" column header, **Then** rows sort by Remaining descending; clicking again toggles ascending.
3. **Given** the manager types "ahm" in the search box, **When** typing pauses, **Then** only clients whose name contains "ahm" (case-insensitive) remain visible.
4. **Given** any combination of filter + sort + search is active, **When** the manager refreshes the page, **Then** the same view is restored (state persists in the URL or localStorage — see assumptions).

---

### Edge Cases

- **Overpayment beyond next-period credit**: If a payment is recorded that exceeds (current Remaining + next-period full Target), the excess is parked as a generic "client credit" on the detail view. It does NOT auto-allocate further forward — the manager applies it manually when ready.
- **Odd Target Cost (e.g. 3001 EGP)**: Installment 1 = `floor(Target/2)` = 1500, Installment 2 = `ceil(Target/2)` = 1501. The system never produces fractional EGP.
- **Zero-target clients (one-off projects)**: A client may have `TargetCost = 0` (one-off project, no recurring retainer). For these, the installment cycle does not apply. Status is computed against `PackageCost`: Remaining = `PackageCost − Paid`, Cleared when fully paid, Partial when partially paid, Pending when nothing paid. Overdue is not applicable to zero-target clients in the MVP.
- **Installment due date falls on a weekend / holiday**: The Overdue rule is calendar-based. If Installment 2 is due on a Friday and today is Sunday, the client is Overdue. Manager handles real-world weekend exceptions by recording the payment with the actual receipt date.
- **Mid-month client onboarding (split-month)**: A client added on day 12 of a month has their first month's Installment 1 due immediately and Installment 2 due 5 days before that month's end. No proration in the MVP.
- **Mid-period client onboarding (anchor-day)**: An anchor-day client (anchor=5) added on day 12 of May has their first period's single installment due day 12 of May (the onboarding day, since day 5 has already passed). The next period starts day 5 of June and follows the standard pattern from then on. No proration of the first period's amount.
- **Anchor day in a short February**: `anchorDay` is constrained to 1–28 at creation so February's varying length never produces an undefined day. (`anchorDay = 31` would have produced "no period boundary in February"; we reject it at validation.)
- **Switching cycle mid-period**: A client moved from `split-month` to `anchor-day` keeps the existing period's installments (still 50/50 with the original due dates). The new cycle activates only at the next period boundary. Same in reverse.
- **Multiple consecutive months of underpayment**: Carry-forward compounds. A client with baseTarget = 5000 who pays 0 in May closes May with Unpaid = 5000. June opens with effectiveTarget = 10,000. If they pay 0 in June too, July opens with effectiveTarget = 15,000. There is no auto-escalation or auto-pause — the manager sees the ballooning Target on the dashboard and decides whether to call, pause, or terminate.
- **Carry-forward when client pays MORE than effectiveTarget**: If a client pays the full effectiveTarget (including carry-forward) AND extra, the extra goes to the prepaid-credit bucket as usual — it does NOT retroactively reduce the prior month's recorded Unpaid. History is immutable.
- **Client pauses then resumes**: A client whose status is "paused" (toggled by manager) does not generate new installments and is excluded from Overdue counts. Resuming starts a fresh period from the day of resume; any carry-forward from the period before pause is preserved and applied to the resume period.
- **Special Services with no client**: Not allowed. Every Special Service must belong to an existing client.
- **Client deletion with history**: Deleting a client removes their Special Services, payment records, and credits — the manager is warned in the confirm dialog. No soft-delete in the MVP.
- **Currency**: All amounts are in EGP only. No multi-currency support in v1.
- **Time zone**: Installment due dates are interpreted in Africa/Cairo. The Overdue threshold flips at midnight Cairo time.
- **Concurrent edits**: Single-user MVP — concurrent-edit conflicts are not in scope.
- **Empty state**: A fresh dashboard with zero clients shows an empty state with a single CTA: "Add your first client".
- **Long names / large amounts**: Client names up to 80 characters (Arabic or Latin script) render without truncation; amounts up to 9,999,999 EGP render without overflow.

## Requirements *(mandatory)*

### Functional Requirements

#### Client roster & dashboard view (US1, US2)

- **FR-001**: System MUST display a dashboard table with one row per client, each showing: client name, Package Cost (EGP), Target Cost (EGP), Paid this period (EGP), Total Ads Amount (EGP, lifetime), Remaining this period (EGP), Payment Status pill.
- **FR-002**: System MUST show a summary strip above the table with: total client count, sum of Remaining across all clients (this period), count of Overdue clients, count of Pending clients.
- **FR-003**: System MUST allow the manager to add a new client with the fields: name, Package Cost (EGP), Target Cost (EGP). The two installments and their due dates are derived automatically from Target and the current calendar month.
- **FR-004**: System MUST allow the manager to edit any client field after creation. Editing Target Cost mid-period rebalances the unpaid portion across the remaining installments (paid amounts are not touched).
- **FR-005**: System MUST allow the manager to delete a client, with a confirmation step that names the client and warns that history will be lost.
- **FR-006**: System MUST compute Remaining as `max(0, RelevantCost − PaidThisPeriod)` where RelevantCost is `Target` (when Target > 0) or `Package` (when Target = 0).
- **FR-007**: Dashboard rows MUST sort by Payment Status priority (Overdue → Pending → Partial → Cleared) by default, then by client name ascending within a status group.

#### Billing cycles (US2)

- **FR-008**: Each active client with `Target > 0` has a `billingCycle` chosen at creation, with one of two values. The cycle determines how a Period is shaped and when installments fall due.
  - **`split-month` (default)** — the calendar month is one Period containing TWO installments:
    - **Installment 1**: amount = `floor(effectiveTarget/2)`, due day 1 of the period (or the onboarding day if the client was added mid-month).
    - **Installment 2**: amount = `effectiveTarget − Installment 1`, due `lastDayOfMonth − 5`.
  - **`anchor-day`** — the manager picks an `anchorDay` (integer 1–28) at creation. Each Period for this client runs from day `anchorDay` of one calendar month to day `anchorDay − 1` of the next. The Period contains a SINGLE installment:
    - **Installment 1 (only)**: amount = `effectiveTarget` (full), due day `anchorDay` of the period start month (or the onboarding day if the client was added mid-period for their very first period).
  - **Changing cycle**: if the manager edits a client's `billingCycle` (or the `anchorDay`), the change applies starting the NEXT period. The current period's installments are not retroactively re-shaped.
- **FR-009**: System MUST allow the manager to record a Payment against any specific (period, installment slot), including future periods. Each Payment captures: amount (EGP), date received, target period, target installment slot (always `1` for anchor-day clients; `1`, `2`, or `credit` for split-month clients), optional note.
- **FR-010**: When a payment is recorded against a future period that is not yet materialized while the current period is Cleared, the system MUST store it as a "credit toward the target period" and surface it on the client detail view as a separate line item — NOT added into the current period's Paid.
- **FR-011**: When a Period rolls over (00:00 Cairo time on the period's start day — day 1 for `split-month` clients, day `anchorDay` for `anchor-day` clients), the system MUST, in this order:
  1. Compute the closing period's `unpaid = max(0, effectiveTarget − PaidThisPeriod)`.
  2. Set the new period's `effectiveTarget = baseTarget + unpaid` (the **carry-forward** rule — any portion of the prior period's Target that went unpaid is added to the next period's expected revenue).
  3. Apply any prepaid credits as the new period's starting `Paid`.
  4. Recompute installments for the new period — **2 installments for `split-month`**, **1 installment for `anchor-day`**.
  5. Recompute Payment Status from the new figures.
  6. The dashboard's Target column shows `effectiveTarget`; the detail view shows the breakdown (`baseTarget` + `carryForwardFromPrev`).
- **FR-012**: Editing or deleting a Payment MUST recompute the affected period's Paid, Remaining, and Status. The manager can correct mistakes without admin intervention. If the payment was in a closed period, the chain MUST propagate forward through every subsequent period.

#### Payment Status (US1, US2)

- **FR-013**: System MUST compute Payment Status from PaidThisPeriod, RelevantCost, and the installment due dates — never from a manually-set status field. The four states are:
  - **Cleared**: `PaidThisPeriod >= RelevantCost`.
  - **Pending**: `PaidThisPeriod == 0` AND no installment due date has passed yet.
  - **Overdue**: `PaidThisPeriod < ExpectedByNow` where `ExpectedByNow = sum of installment amounts whose due date has passed`. (E.g. after Installment 1 due date but before Installment 2 due date, ExpectedByNow = Installment 1 amount.)
  - **Partial**: any non-zero, non-cleared payment that does not meet the Overdue condition.
  - Precedence (when multiple could apply): **Overdue > Cleared > Partial > Pending**.
- **FR-014**: Status pills MUST use a distinct visual treatment per state (color + label), with Overdue carrying the highest visual emphasis (e.g. solid red background) and Cleared the lowest (e.g. muted green ghost). Pending and Partial use neutral / amber tones respectively.

#### Special Services (US3)

- **FR-015**: System MUST allow the manager to add a Special Service to any existing client, capturing: title (required, ≤120 chars), description (optional, ≤1000 chars), price in EGP (required, ≥ 0), date (required), paid flag (required, default false).
- **FR-016**: System MUST display each client's Special Services on their detail view as a list, separated visually into "Unpaid" and "Paid" groups.
- **FR-017**: System MUST allow the manager to toggle a Special Service's paid flag and to edit any of its fields.
- **FR-018**: System MUST keep Special Services accounting **separate** from the package Remaining — the dashboard does NOT add them into the Remaining column.
- **FR-019**: The client detail view MUST surface a "Special Services owed" total (sum of all unpaid Special Services for that client), displayed distinctly from the package Remaining.

#### Notifications (US4)

- **FR-020**: System MUST surface a notification center (bell icon with a numeric badge) showing: clients newly Overdue, clients in Pending state for >7 days, Special Services unpaid for >30 days.
- **FR-021**: Each notification MUST link to the client (and where relevant, the specific Special Service) and MUST display the reason and the date the trigger fired.
- **FR-022**: System MUST display a top-of-page banner when 3 or more clients are Overdue, with a one-click filter to show only Overdue clients.
- **FR-023**: System MUST persist read/unread state per notification.
- **FR-024**: Notifications relating to a condition that has resolved (e.g. an Overdue client paid in full) MUST disappear from the list automatically on next dashboard load.

#### Filtering, sorting, search (US5)

- **FR-025**: The dashboard MUST support a multi-select status filter (any subset of the four states).
- **FR-026**: All numeric and date columns MUST be sortable ascending/descending by clicking the column header.
- **FR-027**: The dashboard MUST provide a name search box that filters rows by case-insensitive substring as the manager types (debounced ≤300ms).
- **FR-028**: Filter, sort, and search state MUST survive a page refresh.

#### Authentication & access (foundational)

- **FR-029**: Dashboard access MUST be gated behind a single sign-in. The MVP serves one account manager — no roles, no per-row ownership. The auth check protects the dashboard from public viewing.

#### Localization

- **FR-030**: The UI labels (Client, Paid, Remaining, Cleared, Partial, Pending, Overdue, etc.) MUST be in English. Client names MAY be in Arabic and the system MUST render them correctly with RTL-aware text alignment within otherwise LTR rows.

#### Visual design

- **FR-031**: The visual design MUST follow the Impeccable design system reference at https://impeccable.style/ — neutral cream/off-white background, restrained typography (a serif for display + sans for body), card components with subtle 8–16px radii, generous whitespace, no purple gradients or "AI-slop" decoration. Status pills are the only place where saturated color is allowed, and only for the Overdue state.

### Areas needing clarification

- **[NEEDS CLARIFICATION]** Audit trail — does the manager need to see "who changed Paid from X to Y at time T"? Spec assumes no for MVP. Acceptable as-is unless flagged.

### Key Entities

- **Client** — A customer of the agency. Holds: name (Arabic or Latin script, ≤80 chars), Package Cost (EGP, full contract value), Target Cost (EGP, recurring per period), Total Ads Amount (EGP, lifetime ad spend the client has paid in), active flag (paused vs active), **billingCycle** (`split-month` or `anchor-day`), **anchorDay** (integer 1–28; only set when billingCycle is `anchor-day`), created date / onboarded-on date.
- **Period** — A billing cycle for a Client. Shape depends on the Client's billingCycle: `split-month` periods follow the calendar month; `anchor-day` periods run from `anchorDay` of one month to `anchorDay − 1` of the next. Holds: client reference, period start date (and derived end date), baseTarget (the Client's standing Target Cost at the time the period was opened), carryForwardFromPrev (the Unpaid amount carried over from the prior period), effectiveTarget (= baseTarget + carryForwardFromPrev), one or two installments depending on cycle, aggregate PaidThisPeriod, and computed Status. Periods are materialized at rollover (or on-demand for the current period) so the carry-forward chain is preserved historically.
- **Installment** — A scheduled inflow within a Period. Holds: parent period reference, slot (always 1 for anchor-day; 1 or 2 for split-month), expected amount (EGP), due date, paid amount (EGP, sum of payments allocated to this slot).
- **Payment** — A single recorded inflow from a client. Holds: client reference, target period, target installment slot (1 or 2 or "credit"), amount (EGP), date received, optional note.
- **Credit** — An advance payment that does not yet belong to any current installment. Holds: client reference, amount (EGP), the period it is intended for. Auto-applied on period rollover.
- **Special Service** — A one-off paid service delivered to a client. Belongs to exactly one Client. Holds: title, optional description, price (EGP), service date, paid flag, paid date (when paid is toggled true).
- **Payment Status** — A computed value (not stored), derived from a Client's PaidThisPeriod, RelevantCost, and the installment due dates. One of: Cleared, Partial, Pending, Overdue.
- **Notification** — An actionable alert for the manager. Holds: trigger type (newly-overdue / pending-stale / special-service-unpaid-long), the Client (and optional Special Service) it relates to, fired-at timestamp, read flag.
- **Manager** — The single authenticated user. Owns the entire client roster.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A manager can identify which clients need a follow-up today within 10 seconds of opening the dashboard (validated by user observation, not code).
- **SC-002**: Adding a new client takes under 30 seconds end-to-end (clicking "Add client", filling fields, seeing the new row appear).
- **SC-003**: Recording a payment against a specific installment takes under 15 seconds from clicking "Record payment" to seeing the dashboard row update.
- **SC-004**: Status pill computed values match expected status in 100% of cases across the full installment-cycle truth table for **both** billing cycles (validated by automated tests). Coverage:
  - `split-month`: before Installment 1 due, after Installment 1 due / before Installment 2, after Installment 2 due — each with paid amounts of 0 / half / full / over.
  - `anchor-day`: before anchor date, on anchor date, after anchor date — each with paid amounts of 0 / half / full / over.
- **SC-005**: Zero overdue clients are missed — every client whose Installment 1 or Installment 2 due date passed with `PaidThisPeriod < ExpectedByNow` shows Overdue on the next dashboard load (no stale status caching).
- **SC-006**: Recording a Special Service takes under 20 seconds from clicking "Add service" to seeing it listed.
- **SC-007**: Notification badge count matches the live count of unresolved triggers within 1 dashboard load (no stale counts).
- **SC-008**: The dashboard renders a 50-client roster in under 1 second on a mid-range laptop on broadband, with all filters/sorts client-side responsive in under 100ms.
- **SC-009**: Period rollover at midnight Cairo time correctly applies all stored prepaid credits AND carry-forward unpaid amounts to the new period within 60 seconds of the next dashboard load on day 1.
- **SC-010-Carry**: Across an automated test that runs 12 consecutive monthly rollovers for a client paying exactly half their Target each month, the carry-forward chain accumulates predictably (after N months, effectiveTarget = baseTarget × (N/2 + 1) until the manager intervenes) — verified to the EGP.
- **SC-010**: Manager satisfaction — informal: after one week of use, the manager reports they no longer need their fallback spreadsheet for tracking who owes what.

## Assumptions

- **Single user.** The MVP serves one agency with one account-manager user — confirmed. Multi-manager / multi-tenant is a deliberate future expansion.
- **EGP only.** All amounts are Egyptian Pounds. No FX, no multi-currency.
- **Two billing cycles per client.** Each active client picks one of two cycles at creation:
  - `split-month` (default): two installments per calendar month — `floor(Target/2)` due day 1, the remainder due `lastDayOfMonth − 5`. Most clients use this.
  - `anchor-day`: one installment per anchor-to-anchor period (e.g. day 5 → day 4 of next month). The full effective Target is due on the anchor day. Used when an invoice is sent on a specific day each month and paid in one shot.
  - The cycle (and `anchorDay` if applicable) can be changed later; the change applies starting the next period. Existing periods are not retroactively reshaped.
- Clients may prepay future installments, which the system tracks as credits and auto-applies on period rollover.
- **Carry-forward of unpaid Target.** Any portion of a closing month's Target that was not paid is added to the next month's effective Target automatically. The dashboard's Target column reflects the *effective* (carry-included) Target so the manager always sees the true outstanding amount. Carry-forward compounds across consecutive underpaid months — there is no auto-pause or auto-cap; the manager intervenes manually.
- **Calendar month period.** Periods follow the calendar month, not contract-anniversary cycles. Period rollover is at 00:00 Cairo time on day 1 of each month.
- **Cairo time zone.** All due-date math runs in Africa/Cairo. The Overdue flip happens at local midnight.
- **In-app notifications only.** Bell icon + summary banner. No email / SMS / WhatsApp in v1.
- **English UI, Arabic-name support.** Field labels are English; client names render correctly when stored in Arabic script (RTL-aware text alignment within table cells).
- **Visual design follows https://impeccable.style/.** Calm, neutral, cream-background, serif-display + sans-body, minimal cards, no gradients or decorative AI-slop. Status pills are the only place where saturated color is permitted (red for Overdue, the rest are muted).
- **Tech stack** *(advisory — to be locked in `plan.md`)*: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4. Persistence: a hosted Postgres (Supabase or similar) — to be decided in plan.
- **Non-goals for v1**: invoice PDF generation, payment-gateway integration, multi-currency, role-based access, mobile-native app, offline mode, audit trail, ad-platform integrations, automatic period-rollover notifications to the client themselves.
