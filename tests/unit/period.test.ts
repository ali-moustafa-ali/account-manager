import { describe, expect, test } from "vitest";
import {
  buildCurrentPeriod,
  buildInstallments,
  currentPeriodKey,
} from "@/lib/domain/period";

const splitClient = {
  billingCycle: "split-month" as const,
  anchorDay: null,
  targetCost: 5000,
  packageCost: 60000,
};

const anchorClient = (anchorDay: number) => ({
  billingCycle: "anchor-day" as const,
  anchorDay,
  targetCost: 8000,
  packageCost: 96000,
});

describe("currentPeriodKey", () => {
  test("split-month always uses today's calendar (year, month)", () => {
    expect(currentPeriodKey(splitClient, "2026-05-15")).toEqual({ year: 2026, month: 5 });
    expect(currentPeriodKey(splitClient, "2026-12-31")).toEqual({ year: 2026, month: 12 });
  });

  test("anchor-day, today >= anchor → today's (year, month)", () => {
    expect(currentPeriodKey(anchorClient(5), "2026-05-05")).toEqual({ year: 2026, month: 5 });
    expect(currentPeriodKey(anchorClient(5), "2026-05-15")).toEqual({ year: 2026, month: 5 });
  });

  test("anchor-day, today < anchor → previous (year, month)", () => {
    expect(currentPeriodKey(anchorClient(15), "2026-05-05")).toEqual({ year: 2026, month: 4 });
    expect(currentPeriodKey(anchorClient(28), "2026-05-05")).toEqual({ year: 2026, month: 4 });
  });

  test("anchor-day, year wraparound across January", () => {
    expect(currentPeriodKey(anchorClient(15), "2026-01-05")).toEqual({ year: 2025, month: 12 });
  });
});

describe("buildInstallments — split-month", () => {
  test("Target=5000 → 2 installments of 2500 each, due day 1 + day 26", () => {
    const insts = buildInstallments(splitClient, 2026, 5, 5000);
    expect(insts).toEqual([
      { slot: 1, expectedAmount: 2500, dueDate: "2026-05-01" },
      { slot: 2, expectedAmount: 2500, dueDate: "2026-05-26" },
    ]);
  });

  test("Target=3001 (odd) → I1=1500, I2=1501", () => {
    const insts = buildInstallments(splitClient, 2026, 5, 3001);
    expect(insts).toEqual([
      { slot: 1, expectedAmount: 1500, dueDate: "2026-05-01" },
      { slot: 2, expectedAmount: 1501, dueDate: "2026-05-26" },
    ]);
  });

  test("February 28 days — slot 2 due Feb 23", () => {
    const insts = buildInstallments(splitClient, 2026, 2, 4000);
    expect(insts[1]?.dueDate).toBe("2026-02-23");
  });

  test("Zero target → no installments", () => {
    expect(buildInstallments(splitClient, 2026, 5, 0)).toEqual([]);
  });
});

describe("buildInstallments — anchor-day", () => {
  test("anchor=5, Target=8000 → single installment due day 5", () => {
    const insts = buildInstallments(anchorClient(5), 2026, 5, 8000);
    expect(insts).toEqual([
      { slot: 1, expectedAmount: 8000, dueDate: "2026-05-05" },
    ]);
  });

  test("anchor=28 in February → due Feb 28", () => {
    const insts = buildInstallments(anchorClient(28), 2026, 2, 4000);
    expect(insts).toEqual([{ slot: 1, expectedAmount: 4000, dueDate: "2026-02-28" }]);
  });
});

describe("buildCurrentPeriod — split-month no carry-forward", () => {
  test("Target=5000, paid 2500 mid-period → Partial, Remaining=2500", () => {
    const result = buildCurrentPeriod(
      splitClient,
      [{ amount: 2500 }],
      null,
      "2026-05-15",
    );
    expect(result.effectiveTarget).toBe(5000);
    expect(result.carryForwardFromPrev).toBe(0);
    expect(result.paidThisPeriod).toBe(2500);
    expect(result.remaining).toBe(2500);
    expect(result.status).toBe("partial");
    expect(result.periodStartDate).toBe("2026-05-01");
    expect(result.periodEndDate).toBe("2026-05-31");
  });
});

describe("buildCurrentPeriod — split-month WITH carry-forward", () => {
  test("baseTarget=5000 + carry=2000 → effectiveTarget=7000, installments rebalance to 3500/3500", () => {
    const result = buildCurrentPeriod(
      splitClient,
      [],
      { closedUnpaid: 2000 },
      "2026-05-15",
    );
    expect(result.baseTarget).toBe(5000);
    expect(result.carryForwardFromPrev).toBe(2000);
    expect(result.effectiveTarget).toBe(7000);
    expect(result.installments).toEqual([
      { slot: 1, expectedAmount: 3500, dueDate: "2026-05-01" },
      { slot: 2, expectedAmount: 3500, dueDate: "2026-05-26" },
    ]);
    expect(result.paidThisPeriod).toBe(0);
    expect(result.remaining).toBe(7000);
    expect(result.status).toBe("overdue"); // I1 due May 1 passed, paid 0
  });
});

describe("buildCurrentPeriod — anchor-day", () => {
  test("anchor=5, today=May 5, paid 0 → Pending (today == anchor)", () => {
    const result = buildCurrentPeriod(
      anchorClient(5),
      [],
      null,
      "2026-05-05",
    );
    expect(result.status).toBe("pending");
    expect(result.periodStartDate).toBe("2026-05-05");
    expect(result.periodEndDate).toBe("2026-06-04");
  });

  test("anchor=5, today=May 6, paid 0 → Overdue (anchor passed)", () => {
    const result = buildCurrentPeriod(
      anchorClient(5),
      [],
      null,
      "2026-05-06",
    );
    expect(result.status).toBe("overdue");
  });

  test("anchor=15, today=May 5 → period is April 15 → May 14", () => {
    const result = buildCurrentPeriod(
      anchorClient(15),
      [],
      null,
      "2026-05-05",
    );
    expect(result.year).toBe(2026);
    expect(result.month).toBe(4);
    expect(result.periodStartDate).toBe("2026-04-15");
    expect(result.periodEndDate).toBe("2026-05-14");
    expect(result.status).toBe("overdue"); // April 15 due passed by May 5
  });
});

describe("buildCurrentPeriod — zero-target client (one-off project)", () => {
  const oneOff = {
    billingCycle: "split-month" as const,
    anchorDay: null,
    targetCost: 0,
    packageCost: 10000,
  };

  test("paid 0 → Pending, Remaining=PackageCost", () => {
    const result = buildCurrentPeriod(oneOff, [], null, "2026-05-15");
    expect(result.effectiveTarget).toBe(10000);
    expect(result.installments).toEqual([]);
    expect(result.remaining).toBe(10000);
    expect(result.status).toBe("pending");
  });

  test("paid full PackageCost → Cleared", () => {
    const result = buildCurrentPeriod(oneOff, [{ amount: 10000 }], null, "2026-05-15");
    expect(result.remaining).toBe(0);
    expect(result.status).toBe("cleared");
  });

  test("paid partial → Partial", () => {
    const result = buildCurrentPeriod(oneOff, [{ amount: 4000 }], null, "2026-05-15");
    expect(result.remaining).toBe(6000);
    expect(result.status).toBe("partial");
  });
});
