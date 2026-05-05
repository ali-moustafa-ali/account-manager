import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  integer,
  smallint,
  timestamp,
  date,
  text,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const clientStatusEnum = pgEnum("client_status", ["active", "paused"]);
export const billingCycleEnum = pgEnum("billing_cycle", ["split-month", "anchor-day"]);

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    packageCost: integer("package_cost").notNull(),
    targetCost: integer("target_cost").notNull(),
    totalAdsAmount: integer("total_ads_amount").notNull().default(0),
    billingCycle: billingCycleEnum("billing_cycle").notNull().default("split-month"),
    anchorDay: smallint("anchor_day"),
    status: clientStatusEnum("status").notNull().default("active"),
    onboardedOn: date("onboarded_on").notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("clients_name_chk", sql`length(${t.name}) > 0`),
    check("clients_package_cost_chk", sql`${t.packageCost} >= 0`),
    check("clients_target_cost_chk", sql`${t.targetCost} >= 0`),
    check("clients_total_ads_chk", sql`${t.totalAdsAmount} >= 0`),
    check(
      "clients_anchor_day_chk",
      sql`(${t.billingCycle} = 'split-month' AND ${t.anchorDay} IS NULL)
          OR (${t.billingCycle} = 'anchor-day' AND ${t.anchorDay} BETWEEN 1 AND 28)`,
    ),
    index("clients_status_idx").on(t.status),
    index("clients_billing_cycle_idx").on(t.billingCycle),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Periods
// ─────────────────────────────────────────────────────────────────────────────

export const periods = pgTable(
  "periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    periodStartDate: date("period_start_date").notNull(),
    periodEndDate: date("period_end_date").notNull(),
    baseTarget: integer("base_target").notNull(),
    carryForwardFromPrev: integer("carry_forward_from_prev").notNull().default(0),
    effectiveTarget: integer("effective_target").notNull(),
    cycleSnapshot: billingCycleEnum("cycle_snapshot").notNull(),
    anchorDaySnapshot: smallint("anchor_day_snapshot"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedUnpaid: integer("closed_unpaid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("periods_year_chk", sql`${t.year} BETWEEN 2024 AND 2100`),
    check("periods_month_chk", sql`${t.month} BETWEEN 1 AND 12`),
    check("periods_base_target_chk", sql`${t.baseTarget} >= 0`),
    check("periods_carry_fwd_chk", sql`${t.carryForwardFromPrev} >= 0`),
    check("periods_effective_target_chk", sql`${t.effectiveTarget} >= 0`),
    check("periods_end_after_start_chk", sql`${t.periodEndDate} >= ${t.periodStartDate}`),
    uniqueIndex("periods_client_year_month_uq").on(t.clientId, t.year, t.month),
    index("periods_client_id_idx").on(t.clientId),
    index("periods_start_date_idx").on(t.periodStartDate),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Installments
// ─────────────────────────────────────────────────────────────────────────────

export const installments = pgTable(
  "installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    slot: smallint("slot").notNull(),
    expectedAmount: integer("expected_amount").notNull(),
    dueDate: date("due_date").notNull(),
  },
  (t) => [
    check("installments_slot_chk", sql`${t.slot} IN (1, 2)`),
    check("installments_expected_chk", sql`${t.expectedAmount} >= 0`),
    uniqueIndex("installments_period_slot_uq").on(t.periodId, t.slot),
    index("installments_due_date_idx").on(t.dueDate),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────────────────────

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").references(() => periods.id, { onDelete: "set null" }),
    targetYear: integer("target_year").notNull(),
    targetMonth: integer("target_month").notNull(),
    slot: smallint("slot"),
    amount: integer("amount").notNull(),
    receivedOn: date("received_on").notNull().defaultNow(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("payments_target_year_chk", sql`${t.targetYear} BETWEEN 2024 AND 2100`),
    check("payments_target_month_chk", sql`${t.targetMonth} BETWEEN 1 AND 12`),
    check("payments_slot_chk", sql`${t.slot} IS NULL OR ${t.slot} IN (1, 2)`),
    check("payments_amount_chk", sql`${t.amount} > 0`),
    index("payments_client_target_idx").on(t.clientId, t.targetYear, t.targetMonth),
    index("payments_period_id_idx").on(t.periodId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Credits (read-optimized projection of advance payments per future period)
// ─────────────────────────────────────────────────────────────────────────────

export const credits = pgTable(
  "credits",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    targetYear: integer("target_year").notNull(),
    targetMonth: integer("target_month").notNull(),
    amount: integer("amount").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.clientId, t.targetYear, t.targetMonth] }),
    check("credits_amount_chk", sql`${t.amount} >= 0`),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Special services
// ─────────────────────────────────────────────────────────────────────────────

export const specialServices = pgTable(
  "special_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),
    price: integer("price").notNull(),
    serviceDate: date("service_date").notNull().defaultNow(),
    paid: boolean("paid").notNull().default(false),
    paidOn: date("paid_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("special_services_title_chk", sql`length(${t.title}) > 0`),
    check(
      "special_services_desc_chk",
      sql`${t.description} IS NULL OR length(${t.description}) <= 1000`,
    ),
    check("special_services_price_chk", sql`${t.price} >= 0`),
    index("special_services_client_idx").on(t.clientId),
    index("special_services_unpaid_age_idx").on(t.paid, t.serviceDate),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Notification read state
// ─────────────────────────────────────────────────────────────────────────────

export const notificationReadState = pgTable("notification_read_state", {
  notificationKey: varchar("notification_key", { length: 128 }).primaryKey(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────────────────────────────────

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Period = typeof periods.$inferSelect;
export type NewPeriod = typeof periods.$inferInsert;
export type Installment = typeof installments.$inferSelect;
export type NewInstallment = typeof installments.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Credit = typeof credits.$inferSelect;
export type SpecialService = typeof specialServices.$inferSelect;
export type NewSpecialService = typeof specialServices.$inferInsert;
