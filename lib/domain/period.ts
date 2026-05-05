import {
  addDaysIso,
  addMonthsCairo,
  dateInCairo,
  dayOfMonth,
  lastDayOfMonthCairo,
} from "@/lib/time/cairo";
import { computeStatus, type PaymentStatus } from "./status";

type BillingCycle = "split-month" | "anchor-day";

interface ClientShape {
  billingCycle: BillingCycle;
  anchorDay: number | null;
  targetCost: number;
  packageCost: number;
}

export interface DerivedInstallment {
  slot: 1 | 2;
  expectedAmount: number;
  dueDate: string;
}

export interface DerivedPeriod {
  year: number;
  month: number;
  periodStartDate: string;
  periodEndDate: string;
  baseTarget: number;
  carryForwardFromPrev: number;
  effectiveTarget: number;
  installments: DerivedInstallment[];
  paidThisPeriod: number;
  remaining: number;
  status: PaymentStatus;
}

/**
 * Returns the (year, month) key under which today's period for this client is stored.
 * - split-month: today's calendar (year, month).
 * - anchor-day: if today's day-of-month >= anchorDay → today's (year, month);
 *               else → previous calendar (year, month).
 */
export function currentPeriodKey(
  client: { billingCycle: BillingCycle; anchorDay: number | null },
  today: string,
): { year: number; month: number } {
  const [yStr, mStr] = today.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = dayOfMonth(today);

  if (client.billingCycle === "split-month" || client.anchorDay === null) {
    return { year, month };
  }
  if (day >= client.anchorDay) {
    return { year, month };
  }
  return addMonthsCairo(year, month, -1);
}

function periodDates(
  client: { billingCycle: BillingCycle; anchorDay: number | null },
  year: number,
  month: number,
): { start: string; end: string } {
  if (client.billingCycle === "split-month" || client.anchorDay === null) {
    return {
      start: dateInCairo(year, month, 1),
      end: lastDayOfMonthCairo(year, month),
    };
  }
  const start = dateInCairo(year, month, client.anchorDay);
  const next = addMonthsCairo(year, month, 1);
  const nextAnchorStart = dateInCairo(next.year, next.month, client.anchorDay);
  const end = addDaysIso(nextAnchorStart, -1);
  return { start, end };
}

export function buildInstallments(
  client: { billingCycle: BillingCycle; anchorDay: number | null },
  year: number,
  month: number,
  effectiveTarget: number,
): DerivedInstallment[] {
  if (effectiveTarget === 0) return [];
  const { start, end: _end } = periodDates(client, year, month);

  if (client.billingCycle === "split-month" || client.anchorDay === null) {
    const slot1 = Math.floor(effectiveTarget / 2);
    const slot2 = effectiveTarget - slot1;
    const lastDay = Number(lastDayOfMonthCairo(year, month).split("-")[2]);
    return [
      { slot: 1, expectedAmount: slot1, dueDate: start },
      { slot: 2, expectedAmount: slot2, dueDate: dateInCairo(year, month, lastDay - 5) },
    ];
  }
  return [{ slot: 1, expectedAmount: effectiveTarget, dueDate: start }];
}

/**
 * Compose the current period's full state from the Client + their payments + the prior closed period.
 */
export function buildCurrentPeriod(
  client: ClientShape,
  paymentsForCurrentPeriod: ReadonlyArray<{ amount: number }>,
  prevClosedPeriod: { closedUnpaid: number | null } | null,
  today: string,
): DerivedPeriod {
  const totalPaid = paymentsForCurrentPeriod.reduce((s, p) => s + p.amount, 0);

  // Zero-target client: one-off project. Status against PackageCost.
  if (client.targetCost === 0) {
    const remaining = Math.max(0, client.packageCost - totalPaid);
    const status: PaymentStatus =
      totalPaid >= client.packageCost
        ? "cleared"
        : totalPaid === 0
          ? "pending"
          : "partial";
    const [yStr, mStr] = today.split("-");
    return {
      year: Number(yStr),
      month: Number(mStr),
      periodStartDate: today,
      periodEndDate: today,
      baseTarget: client.packageCost,
      carryForwardFromPrev: 0,
      effectiveTarget: client.packageCost,
      installments: [],
      paidThisPeriod: totalPaid,
      remaining,
      status,
    };
  }

  const { year, month } = currentPeriodKey(client, today);
  const { start, end } = periodDates(client, year, month);
  const baseTarget = client.targetCost;
  const carryForwardFromPrev = prevClosedPeriod?.closedUnpaid ?? 0;
  const effectiveTarget = baseTarget + carryForwardFromPrev;
  const installments = buildInstallments(client, year, month, effectiveTarget);
  const remaining = Math.max(0, effectiveTarget - totalPaid);
  const status = computeStatus({ effectiveTarget, paid: totalPaid, installments, today });

  return {
    year,
    month,
    periodStartDate: start,
    periodEndDate: end,
    baseTarget,
    carryForwardFromPrev,
    effectiveTarget,
    installments,
    paidThisPeriod: totalPaid,
    remaining,
    status,
  };
}
