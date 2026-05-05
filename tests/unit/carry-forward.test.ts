import { describe, expect, test } from "vitest";
import {
  computeClosingValues,
  computeOpeningValues,
  isRolloverDay,
  computePeriodDates,
} from "@/lib/domain/carry-forward";

describe("computeClosingValues", () => {
  test("paid 0 of 5000 → unpaid 5000", () => {
    expect(computeClosingValues({ effectiveTarget: 5000 }, 0)).toEqual({ closedUnpaid: 5000 });
  });
  test("paid 3000 of 5000 → unpaid 2000", () => {
    expect(computeClosingValues({ effectiveTarget: 5000 }, 3000)).toEqual({ closedUnpaid: 2000 });
  });
  test("paid 5000 of 5000 → unpaid 0 (cleared)", () => {
    expect(computeClosingValues({ effectiveTarget: 5000 }, 5000)).toEqual({ closedUnpaid: 0 });
  });
  test("overpayment → unpaid 0 (no negative)", () => {
    expect(computeClosingValues({ effectiveTarget: 5000 }, 6000)).toEqual({ closedUnpaid: 0 });
  });
});

describe("computeOpeningValues", () => {
  test("base 5000 + carry 2000 → effective 7000, no credit", () => {
    expect(computeOpeningValues({ baseTarget: 5000, carryForwardFromPrev: 2000, prepaidCredit: 0 }))
      .toEqual({ effectiveTarget: 7000, startingPaid: 0 });
  });
  test("base 5000 + carry 0 + credit 1500 → effective 5000, starting paid 1500", () => {
    expect(computeOpeningValues({ baseTarget: 5000, carryForwardFromPrev: 0, prepaidCredit: 1500 }))
      .toEqual({ effectiveTarget: 5000, startingPaid: 1500 });
  });
  test("base 5000 + carry 2000 + credit 1500 → effective 7000, starting paid 1500", () => {
    expect(computeOpeningValues({ baseTarget: 5000, carryForwardFromPrev: 2000, prepaidCredit: 1500 }))
      .toEqual({ effectiveTarget: 7000, startingPaid: 1500 });
  });
});

describe("12-month carry-forward chain (SC-010-Carry)", () => {
  // A client with baseTarget=5000 paying exactly half (2500) each month.
  // After N months of half-paying, the (N+1)th period's effectiveTarget = baseTarget × (N/2 + 1).
  test("after 12 months of paying exactly 2500 each, effectiveTarget reaches 35000", () => {
    const baseTarget = 5000;
    const halfPayment = 2500;
    let effectiveTarget = baseTarget;

    const checkpoints: Array<{ month: number; effectiveTarget: number }> = [];
    for (let n = 1; n <= 12; n++) {
      // Close period n: paid halfPayment, unpaid = effectiveTarget - 2500
      const { closedUnpaid } = computeClosingValues({ effectiveTarget }, halfPayment);
      // Open period n+1
      const { effectiveTarget: nextEffective } = computeOpeningValues({
        baseTarget,
        carryForwardFromPrev: closedUnpaid,
        prepaidCredit: 0,
      });
      effectiveTarget = nextEffective;
      checkpoints.push({ month: n + 1, effectiveTarget });
    }

    // Per the formula: target_{N+1} = baseTarget × (N/2 + 1) = 5000 × 7 = 35000 after N=12.
    expect(checkpoints[11]).toEqual({ month: 13, effectiveTarget: 35000 });
    expect(checkpoints[5]).toEqual({ month: 7, effectiveTarget: 20000 }); // N=6: 5000 × (6/2 + 1) = 20000
    expect(checkpoints[0]).toEqual({ month: 2, effectiveTarget: 7500 }); // N=1: 5000 × (1/2 + 1) = 7500
  });

  test("client paying 0 every month → effectiveTarget grows by baseTarget each rollover", () => {
    const baseTarget = 5000;
    let effectiveTarget = baseTarget;
    for (let n = 1; n <= 5; n++) {
      const { closedUnpaid } = computeClosingValues({ effectiveTarget }, 0);
      effectiveTarget = computeOpeningValues({
        baseTarget,
        carryForwardFromPrev: closedUnpaid,
        prepaidCredit: 0,
      }).effectiveTarget;
    }
    // After 5 closures: target_6 = baseTarget × 6 = 30000
    expect(effectiveTarget).toBe(30000);
  });

  test("client paying full each month → no carry-forward, effectiveTarget stays constant", () => {
    const baseTarget = 5000;
    let effectiveTarget = baseTarget;
    for (let n = 1; n <= 12; n++) {
      const { closedUnpaid } = computeClosingValues({ effectiveTarget }, baseTarget);
      effectiveTarget = computeOpeningValues({
        baseTarget,
        carryForwardFromPrev: closedUnpaid,
        prepaidCredit: 0,
      }).effectiveTarget;
    }
    expect(effectiveTarget).toBe(baseTarget);
  });
});

describe("isRolloverDay", () => {
  const split = { billingCycle: "split-month" as const, anchorDay: null };
  const anchor = (d: number) => ({ billingCycle: "anchor-day" as const, anchorDay: d });

  test("split-month: only day 1", () => {
    expect(isRolloverDay(split, "2026-05-01")).toBe(true);
    expect(isRolloverDay(split, "2026-05-02")).toBe(false);
    expect(isRolloverDay(split, "2026-05-31")).toBe(false);
  });

  test("anchor-day: only on anchor day", () => {
    expect(isRolloverDay(anchor(5), "2026-05-05")).toBe(true);
    expect(isRolloverDay(anchor(5), "2026-05-04")).toBe(false);
    expect(isRolloverDay(anchor(28), "2026-02-28")).toBe(true);
    expect(isRolloverDay(anchor(28), "2026-02-27")).toBe(false);
  });
});

describe("computePeriodDates — anchor-day cycles", () => {
  test("anchor=5 in May → May 5 to June 4", () => {
    expect(computePeriodDates({ billingCycle: "anchor-day", anchorDay: 5 }, 2026, 5)).toEqual({
      periodStartDate: "2026-05-05",
      periodEndDate: "2026-06-04",
    });
  });
  test("anchor=28 in February → Feb 28 to March 27", () => {
    expect(computePeriodDates({ billingCycle: "anchor-day", anchorDay: 28 }, 2026, 2)).toEqual({
      periodStartDate: "2026-02-28",
      periodEndDate: "2026-03-27",
    });
  });
  test("anchor=15 across year boundary (Dec 15 → Jan 14)", () => {
    expect(computePeriodDates({ billingCycle: "anchor-day", anchorDay: 15 }, 2026, 12)).toEqual({
      periodStartDate: "2026-12-15",
      periodEndDate: "2027-01-14",
    });
  });
  test("split-month February (28 days)", () => {
    expect(computePeriodDates({ billingCycle: "split-month", anchorDay: null }, 2026, 2)).toEqual({
      periodStartDate: "2026-02-01",
      periodEndDate: "2026-02-28",
    });
  });
});
