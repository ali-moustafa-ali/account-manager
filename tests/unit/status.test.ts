import { describe, expect, test } from "vitest";
import { computeStatus } from "@/lib/domain/status";

const splitMonthInstallments = (target: number) => [
  { expectedAmount: Math.floor(target / 2), dueDate: "2026-05-01" },
  { expectedAmount: target - Math.floor(target / 2), dueDate: "2026-05-26" },
];

const anchorDayInstallments = (target: number, dueDate: string) => [
  { expectedAmount: target, dueDate },
];

describe("computeStatus — split-month cycle (Target=5000)", () => {
  const target = 5000;
  const insts = splitMonthInstallments(target);

  // Date positions: before I1 due (Apr 30), after I1 before I2 (May 15), after I2 (May 27).
  // Paid amounts: 0, 2500 (I1), 5000 (full), 6000 (over).
  test.each([
    // [today,        paid, expected]
    ["2026-04-30",  0,    "pending"],   // before I1 due, nothing paid
    ["2026-04-30",  2500, "partial"],   // before I1 due, partly paid early
    ["2026-04-30",  5000, "cleared"],   // fully prepaid before any due date
    ["2026-04-30",  6000, "cleared"],   // overpaid

    ["2026-05-15",  0,    "overdue"],   // I1 due passed (May 1), 0 paid
    ["2026-05-15",  2500, "partial"],   // I1 paid (matches expectedByNow)
    ["2026-05-15",  5000, "cleared"],   // fully paid
    ["2026-05-15",  6000, "cleared"],   // overpaid

    ["2026-05-27",  0,    "overdue"],   // both installments due passed, 0 paid
    ["2026-05-27",  2500, "overdue"],   // I1 paid but I2 due passed → still owe 2500
    ["2026-05-27",  5000, "cleared"],   // fully paid
    ["2026-05-27",  6000, "cleared"],   // overpaid
  ])("today=%s paid=%i → %s", (today, paid, expected) => {
    expect(computeStatus({ effectiveTarget: target, paid, installments: insts, today })).toBe(expected);
  });
});

describe("computeStatus — anchor-day cycle (Target=8000, anchor=5)", () => {
  const target = 8000;
  // Period for May (anchor=5): May 5 → June 4. Single installment due May 5.
  const insts = anchorDayInstallments(target, "2026-05-05");

  // Date positions: before anchor (May 4), on anchor (May 5), after anchor (May 6).
  test.each([
    ["2026-05-04",  0,    "pending"],   // anchor not yet today
    ["2026-05-04",  4000, "partial"],   // partial early
    ["2026-05-04",  8000, "cleared"],   // fully prepaid
    ["2026-05-04",  9000, "cleared"],   // overpaid

    ["2026-05-05",  0,    "pending"],   // anchor today (due date is "today" not "passed")
    ["2026-05-05",  4000, "partial"],   // partial on due day
    ["2026-05-05",  8000, "cleared"],   // fully paid on due day
    ["2026-05-05",  9000, "cleared"],   // overpaid

    ["2026-05-06",  0,    "overdue"],   // anchor passed yesterday, 0 paid
    ["2026-05-06",  4000, "overdue"],   // partial < expected (8000)
    ["2026-05-06",  8000, "cleared"],   // fully paid
    ["2026-05-06",  9000, "cleared"],   // overpaid
  ])("today=%s paid=%i → %s", (today, paid, expected) => {
    expect(computeStatus({ effectiveTarget: target, paid, installments: insts, today })).toBe(expected);
  });
});

describe("computeStatus — zero-effective-target edge", () => {
  test("zero target, zero paid → pending", () => {
    expect(computeStatus({ effectiveTarget: 0, paid: 0, installments: [], today: "2026-05-15" })).toBe("pending");
  });
  test("zero target, any paid → cleared (overpayment / refund pending)", () => {
    expect(computeStatus({ effectiveTarget: 0, paid: 100, installments: [], today: "2026-05-15" })).toBe("cleared");
  });
});

describe("computeStatus — odd target / fractional split", () => {
  // Target=3001 → I1=1500, I2=1501
  const insts = splitMonthInstallments(3001);
  test("paying exactly I1 amount mid-period is Partial", () => {
    expect(computeStatus({
      effectiveTarget: 3001,
      paid: 1500,
      installments: insts,
      today: "2026-05-15",
    })).toBe("partial");
  });
  test("paying full target is Cleared", () => {
    expect(computeStatus({
      effectiveTarget: 3001,
      paid: 3001,
      installments: insts,
      today: "2026-05-27",
    })).toBe("cleared");
  });
});
