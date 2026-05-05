import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import { db } from "./client";
import {
  clients,
  credits,
  notificationReadState,
  payments,
  periods,
  specialServices,
  type Client,
  type Payment,
  type SpecialService,
} from "./schema";
import { buildCurrentPeriod, currentPeriodKey, type DerivedPeriod } from "@/lib/domain/period";
import { addMonthsCairo, todayInCairo } from "@/lib/time/cairo";
import {
  buildNotifications,
  type Notification,
} from "@/lib/domain/notifications";

export interface RosterEntry {
  client: Client;
  period: DerivedPeriod;
}

export interface ClientDetail {
  client: Client;
  currentPeriod: DerivedPeriod;
  payments: Payment[];
  credits: Array<{ targetYear: number; targetMonth: number; amount: number }>;
  specialServices: SpecialService[];
  specialServicesOwed: number;
  today: string;
}

export async function fetchRoster(): Promise<RosterEntry[]> {
  const today = todayInCairo();
  const [yStr, mStr] = today.split("-");
  const calendarYear = Number(yStr);
  const calendarMonth = Number(mStr);
  const prevCalendar = addMonthsCairo(calendarYear, calendarMonth, -1);

  // Three parallel queries.
  const [clientList, allClosedPeriods, recentPayments] = await Promise.all([
    db.select().from(clients).where(eq(clients.status, "active")),
    db
      .select({
        clientId: periods.clientId,
        year: periods.year,
        month: periods.month,
        closedUnpaid: periods.closedUnpaid,
      })
      .from(periods)
      .where(isNotNull(periods.closedAt)),
    db
      .select({
        clientId: payments.clientId,
        targetYear: payments.targetYear,
        targetMonth: payments.targetMonth,
        amount: payments.amount,
      })
      .from(payments)
      .where(
        or(
          and(
            eq(payments.targetYear, calendarYear),
            eq(payments.targetMonth, calendarMonth),
          ),
          and(
            eq(payments.targetYear, prevCalendar.year),
            eq(payments.targetMonth, prevCalendar.month),
          ),
        ),
      ),
  ]);

  // Index closed periods by client → most recent
  const prevClosedByClient = new Map<
    string,
    { year: number; month: number; closedUnpaid: number | null }
  >();
  for (const p of allClosedPeriods) {
    const existing = prevClosedByClient.get(p.clientId);
    if (
      !existing ||
      p.year > existing.year ||
      (p.year === existing.year && p.month > existing.month)
    ) {
      prevClosedByClient.set(p.clientId, p);
    }
  }

  // Index payments by (client, year, month)
  const paymentKey = (clientId: string, year: number, month: number) =>
    `${clientId}:${year}:${month}`;
  const paymentsByKey = new Map<string, Array<{ amount: number }>>();
  for (const p of recentPayments) {
    const k = paymentKey(p.clientId, p.targetYear, p.targetMonth);
    if (!paymentsByKey.has(k)) paymentsByKey.set(k, []);
    paymentsByKey.get(k)!.push({ amount: p.amount });
  }

  return clientList.map((client) => {
    const periodKey = currentPeriodKey(
      { billingCycle: client.billingCycle, anchorDay: client.anchorDay },
      today,
    );
    const periodPayments =
      paymentsByKey.get(paymentKey(client.id, periodKey.year, periodKey.month)) ?? [];
    const prevClosedRaw = prevClosedByClient.get(client.id);
    const prevClosed = prevClosedRaw
      ? { closedUnpaid: prevClosedRaw.closedUnpaid }
      : null;
    const period = buildCurrentPeriod(client, periodPayments, prevClosed, today);
    return { client, period };
  });
}

export async function fetchClientDetail(id: string): Promise<ClientDetail | null> {
  const today = todayInCairo();

  const [clientRows, allPayments, allCredits, closedPeriodRows, allSpecialServices] =
    await Promise.all([
      db.select().from(clients).where(eq(clients.id, id)).limit(1),
      db
        .select()
        .from(payments)
        .where(eq(payments.clientId, id))
        .orderBy(desc(payments.receivedOn)),
      db.select().from(credits).where(eq(credits.clientId, id)),
      db
        .select({
          year: periods.year,
          month: periods.month,
          closedUnpaid: periods.closedUnpaid,
        })
        .from(periods)
        .where(and(eq(periods.clientId, id), isNotNull(periods.closedAt))),
      db
        .select()
        .from(specialServices)
        .where(eq(specialServices.clientId, id))
        .orderBy(desc(specialServices.serviceDate)),
    ]);

  const client = clientRows[0];
  if (!client) return null;

  // Most recent closed period
  const sortedClosed = [...closedPeriodRows].sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month,
  );
  const prevClosed = sortedClosed[0] ? { closedUnpaid: sortedClosed[0].closedUnpaid } : null;

  // Payments allocated to the current period
  const periodKey = currentPeriodKey(
    { billingCycle: client.billingCycle, anchorDay: client.anchorDay },
    today,
  );
  const currentPeriodPayments = allPayments
    .filter((p) => p.targetYear === periodKey.year && p.targetMonth === periodKey.month)
    .map((p) => ({ amount: p.amount }));

  const currentPeriod = buildCurrentPeriod(client, currentPeriodPayments, prevClosed, today);

  const specialServicesOwed = allSpecialServices
    .filter((s) => !s.paid)
    .reduce((sum, s) => sum + s.price, 0);

  return {
    client,
    currentPeriod,
    payments: allPayments,
    credits: allCredits.map((c) => ({
      targetYear: c.targetYear,
      targetMonth: c.targetMonth,
      amount: c.amount,
    })),
    specialServices: allSpecialServices,
    specialServicesOwed,
    today,
  };
}

export async function fetchNotifications(): Promise<Notification[]> {
  const today = todayInCairo();
  const [roster, allUnpaidServices, readRows] = await Promise.all([
    fetchRoster(),
    db
      .select({
        id: specialServices.id,
        clientId: specialServices.clientId,
        clientName: clients.name,
        title: specialServices.title,
        serviceDate: specialServices.serviceDate,
        paid: specialServices.paid,
      })
      .from(specialServices)
      .innerJoin(clients, eq(specialServices.clientId, clients.id))
      .where(eq(specialServices.paid, false)),
    db.select({ key: notificationReadState.notificationKey }).from(notificationReadState),
  ]);

  const readState = new Set(readRows.map((r) => r.key));

  return buildNotifications({
    rosterEntries: roster.map((r) => ({
      client: { id: r.client.id, name: r.client.name },
      period: r.period,
    })),
    specialServices: allUnpaidServices,
    readState,
    today,
  });
}
