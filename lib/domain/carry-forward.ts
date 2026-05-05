import {
  addDaysIso,
  addMonthsCairo,
  dateInCairo,
  dayOfMonth,
  lastDayOfMonthCairo,
} from "@/lib/time/cairo";

type BillingCycle = "split-month" | "anchor-day";

export interface ClosingValues {
  closedUnpaid: number;
}

/**
 * Closing snapshot for a period at rollover time.
 * unpaid = max(0, effectiveTarget − totalPaid). This becomes carryForward for next period.
 */
export function computeClosingValues(
  period: { effectiveTarget: number },
  totalPaidThisPeriod: number,
): ClosingValues {
  return {
    closedUnpaid: Math.max(0, period.effectiveTarget - totalPaidThisPeriod),
  };
}

export interface OpeningValues {
  effectiveTarget: number;
  startingPaid: number;
}

/**
 * Opening values for a brand-new period rolled over from a closing one.
 * effectiveTarget = baseTarget + carryForwardFromPrev. startingPaid = sum of credits applied.
 */
export function computeOpeningValues(input: {
  baseTarget: number;
  carryForwardFromPrev: number;
  prepaidCredit: number;
}): OpeningValues {
  return {
    effectiveTarget: input.baseTarget + input.carryForwardFromPrev,
    startingPaid: input.prepaidCredit,
  };
}

/**
 * Returns the (year, month) key for the period that closes at this rollover (= the period BEFORE today's new period).
 */
export function closingPeriodKey(
  client: { billingCycle: BillingCycle; anchorDay: number | null },
  today: string,
): { year: number; month: number } {
  const [yStr, mStr] = today.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  return addMonthsCairo(year, month, -1);
}

/**
 * Computes the period boundaries (start + end dates) for a given (year, month) under the client's cycle.
 */
export function computePeriodDates(
  client: { billingCycle: BillingCycle; anchorDay: number | null; onboardedOn?: string },
  year: number,
  month: number,
  isFirstPeriod: boolean = false,
): { periodStartDate: string; periodEndDate: string } {
  if (client.billingCycle === "split-month" || client.anchorDay === null) {
    const start =
      isFirstPeriod && client.onboardedOn && monthMatches(client.onboardedOn, year, month)
        ? client.onboardedOn
        : dateInCairo(year, month, 1);
    return { periodStartDate: start, periodEndDate: lastDayOfMonthCairo(year, month) };
  }
  const anchorStart =
    isFirstPeriod && client.onboardedOn && monthMatches(client.onboardedOn, year, month)
      ? client.onboardedOn
      : dateInCairo(year, month, client.anchorDay);
  const next = addMonthsCairo(year, month, 1);
  const nextAnchorStart = dateInCairo(next.year, next.month, client.anchorDay);
  return { periodStartDate: anchorStart, periodEndDate: addDaysIso(nextAnchorStart, -1) };
}

/**
 * Returns true if `today` is a rollover day for this client.
 *  - split-month: rollover on day 1 of any month.
 *  - anchor-day: rollover on day == anchorDay.
 */
export function isRolloverDay(
  client: { billingCycle: BillingCycle; anchorDay: number | null },
  today: string,
): boolean {
  const day = dayOfMonth(today);
  if (client.billingCycle === "split-month" || client.anchorDay === null) {
    return day === 1;
  }
  return day === client.anchorDay;
}

function monthMatches(date: string, year: number, month: number): boolean {
  const [y, m] = date.split("-");
  return Number(y) === year && Number(m) === month;
}
