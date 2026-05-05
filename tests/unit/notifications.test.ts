import { describe, expect, test } from "vitest";
import {
  buildNotifications,
  type RosterEntryForNotifications,
  type SpecialServiceForNotifications,
} from "@/lib/domain/notifications";
import { type DerivedPeriod } from "@/lib/domain/period";

function overduePeriod(year: number, month: number, remaining = 5000): DerivedPeriod {
  const m = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastMinus5 = String(lastDay - 5).padStart(2, "0");
  return {
    year,
    month,
    periodStartDate: `${year}-${m}-01`,
    periodEndDate: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
    baseTarget: 5000,
    carryForwardFromPrev: 0,
    effectiveTarget: 5000,
    installments: [
      { slot: 1, expectedAmount: 2500, dueDate: `${year}-${m}-01` },
      { slot: 2, expectedAmount: 2500, dueDate: `${year}-${m}-${lastMinus5}` },
    ],
    paidThisPeriod: 0,
    remaining,
    status: "overdue",
  };
}

function clearedPeriod(): DerivedPeriod {
  return {
    ...overduePeriod(2026, 5),
    paidThisPeriod: 5000,
    remaining: 0,
    status: "cleared",
  };
}

const today = "2026-05-15";
const emptyRead = new Set<string>();

describe("buildNotifications — overdue triggers", () => {
  test("generates one overdue notification per overdue client", () => {
    const entries: RosterEntryForNotifications[] = [
      { client: { id: "c1", name: "Acme" }, period: overduePeriod(2026, 5) },
      { client: { id: "c2", name: "Beta" }, period: clearedPeriod() },
      { client: { id: "c3", name: "Gamma" }, period: overduePeriod(2026, 5) },
    ];
    const result = buildNotifications({
      rosterEntries: entries,
      specialServices: [],
      readState: emptyRead,
      today,
    });
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.clientId).sort()).toEqual(["c1", "c3"]);
  });

  test("notification key includes the earliest overdue installment date — distinct keys per period", () => {
    const r1 = buildNotifications({
      rosterEntries: [{ client: { id: "c1", name: "Acme" }, period: overduePeriod(2026, 5) }],
      specialServices: [],
      readState: emptyRead,
      today: "2026-05-15",
    });
    expect(r1[0]!.key).toBe("overdue:c1:2026-05-01");

    const r2 = buildNotifications({
      rosterEntries: [{ client: { id: "c1", name: "Acme" }, period: overduePeriod(2026, 6) }],
      specialServices: [],
      readState: emptyRead,
      today: "2026-06-15",
    });
    expect(r2[0]!.key).toBe("overdue:c1:2026-06-01");
    expect(r1[0]!.key).not.toBe(r2[0]!.key);
  });

  test("read state from input correctly marks notifications", () => {
    const entries: RosterEntryForNotifications[] = [
      { client: { id: "c1", name: "Acme" }, period: overduePeriod(2026, 5) },
    ];
    const result = buildNotifications({
      rosterEntries: entries,
      specialServices: [],
      readState: new Set(["overdue:c1:2026-05-01"]),
      today,
    });
    expect(result[0]!.read).toBe(true);
  });

  test("resolved overdue (now cleared) does NOT generate a notification — automatic disappearance", () => {
    const entries: RosterEntryForNotifications[] = [
      { client: { id: "c1", name: "Acme" }, period: clearedPeriod() },
    ];
    const result = buildNotifications({
      rosterEntries: entries,
      specialServices: [],
      readState: new Set(["overdue:c1:2026-05-01"]), // previously read, now resolved
      today,
    });
    expect(result).toHaveLength(0);
  });
});

describe("buildNotifications — stale special services", () => {
  const baseService = (overrides: Partial<SpecialServiceForNotifications>): SpecialServiceForNotifications => ({
    id: "s1",
    clientId: "c1",
    clientName: "Acme",
    title: "Logo redesign",
    serviceDate: "2026-04-10",
    paid: false,
    ...overrides,
  });

  test("unpaid service > 30 days old fires notification", () => {
    const result = buildNotifications({
      rosterEntries: [],
      specialServices: [baseService({ serviceDate: "2026-04-10" })], // 35 days old at today=05-15
      readState: emptyRead,
      today,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("service-stale");
    expect(result[0]!.serviceId).toBe("s1");
  });

  test("unpaid service exactly 30 days old does NOT fire (strict > 30)", () => {
    const result = buildNotifications({
      rosterEntries: [],
      specialServices: [baseService({ serviceDate: "2026-04-15" })], // exactly 30 days
      readState: emptyRead,
      today,
    });
    expect(result).toHaveLength(0);
  });

  test("paid service does NOT fire regardless of age", () => {
    const result = buildNotifications({
      rosterEntries: [],
      specialServices: [baseService({ serviceDate: "2026-01-01", paid: true })],
      readState: emptyRead,
      today,
    });
    expect(result).toHaveLength(0);
  });
});

describe("buildNotifications — sort order", () => {
  test("unread always above read", () => {
    const entries: RosterEntryForNotifications[] = [
      { client: { id: "c1", name: "Older read" }, period: overduePeriod(2026, 4) }, // older
      { client: { id: "c2", name: "Newer unread" }, period: overduePeriod(2026, 5) },
    ];
    const result = buildNotifications({
      rosterEntries: entries,
      specialServices: [],
      readState: new Set(["overdue:c1:2026-04-01"]), // older one is read
      today,
    });
    expect(result[0]!.clientId).toBe("c2"); // unread first
    expect(result[1]!.clientId).toBe("c1");
  });

  test("within same read-state, oldest firedDate first (most urgent)", () => {
    const entries: RosterEntryForNotifications[] = [
      { client: { id: "c1", name: "Newer" }, period: overduePeriod(2026, 5) },
      { client: { id: "c2", name: "Older" }, period: overduePeriod(2026, 4) },
    ];
    const result = buildNotifications({
      rosterEntries: entries,
      specialServices: [],
      readState: emptyRead,
      today,
    });
    expect(result[0]!.clientId).toBe("c2"); // older firedDate = more urgent
    expect(result[1]!.clientId).toBe("c1");
  });
});
