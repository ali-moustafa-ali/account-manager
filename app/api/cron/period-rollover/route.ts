import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clients, payments, periods, type Client } from "@/lib/db/schema";
import { todayInCairo } from "@/lib/time/cairo";
import {
  closingPeriodKey,
  computePeriodDates,
  isRolloverDay,
} from "@/lib/domain/carry-forward";

/**
 * Daily cron at 00:05 Cairo. For each active client whose rollover day is today,
 * materializes the prior period as closed (with closed_unpaid snapshot).
 * Idempotent: re-running on the same day for the same client is a no-op.
 *
 * The dashboard does not depend on materialized periods — it lazy-computes from
 * payments + the most recent closed period. This handler is the audit-trail writer.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("x-vercel-cron-signature");
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/, "") ?? null;
  const token = sig ?? auth;
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayInCairo();
  const activeClients = await db.select().from(clients).where(eq(clients.status, "active"));

  let rolledOver = 0;
  const errors: Array<{ clientId: string; message: string }> = [];

  for (const client of activeClients) {
    if (
      !isRolloverDay(
        { billingCycle: client.billingCycle, anchorDay: client.anchorDay },
        today,
      )
    ) {
      continue;
    }
    try {
      await closePriorPeriod(client, today);
      rolledOver += 1;
    } catch (err) {
      errors.push({
        clientId: client.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    today,
    clientsProcessed: activeClients.length,
    rolledOver,
    errors,
  });
}

async function closePriorPeriod(client: Client, today: string): Promise<void> {
  const { year: pyear, month: pmonth } = closingPeriodKey(
    { billingCycle: client.billingCycle, anchorDay: client.anchorDay },
    today,
  );

  // Sum payments allocated to the closing period
  const allPayments = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(
      and(
        eq(payments.clientId, client.id),
        eq(payments.targetYear, pyear),
        eq(payments.targetMonth, pmonth),
      ),
    );
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);

  // Most recent closed period (one before the closing one)
  const prevClosed = await db
    .select({ closedUnpaid: periods.closedUnpaid })
    .from(periods)
    .where(and(eq(periods.clientId, client.id), isNotNull(periods.closedAt)))
    .orderBy(desc(periods.year), desc(periods.month))
    .limit(1);
  const carryForwardFromPrev = prevClosed[0]?.closedUnpaid ?? 0;
  const baseTarget = client.targetCost;
  const effectiveTarget = baseTarget + carryForwardFromPrev;
  const closedUnpaid = Math.max(0, effectiveTarget - totalPaid);

  const dates = computePeriodDates(
    { billingCycle: client.billingCycle, anchorDay: client.anchorDay },
    pyear,
    pmonth,
  );

  await db
    .insert(periods)
    .values({
      clientId: client.id,
      year: pyear,
      month: pmonth,
      periodStartDate: dates.periodStartDate,
      periodEndDate: dates.periodEndDate,
      baseTarget,
      carryForwardFromPrev,
      effectiveTarget,
      cycleSnapshot: client.billingCycle,
      anchorDaySnapshot: client.anchorDay,
      closedAt: new Date(),
      closedUnpaid,
    })
    .onConflictDoUpdate({
      target: [periods.clientId, periods.year, periods.month],
      set: { closedAt: new Date(), closedUnpaid },
    });
}
