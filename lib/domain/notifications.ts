import { daysFromCairo } from "@/lib/time/cairo";
import { type DerivedPeriod } from "./period";

export type NotificationType = "overdue" | "service-stale";

export interface Notification {
  key: string;
  type: NotificationType;
  clientId: string;
  clientName: string;
  serviceId?: string;
  serviceTitle?: string;
  message: string;
  firedDate: string; // YYYY-MM-DD
  read: boolean;
}

export interface RosterEntryForNotifications {
  client: { id: string; name: string };
  period: DerivedPeriod;
}

export interface SpecialServiceForNotifications {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  serviceDate: string;
  paid: boolean;
}

const STALE_SERVICE_DAYS = 30;

export function buildNotifications({
  rosterEntries,
  specialServices,
  readState,
  today,
}: {
  rosterEntries: ReadonlyArray<RosterEntryForNotifications>;
  specialServices: ReadonlyArray<SpecialServiceForNotifications>;
  readState: ReadonlySet<string>;
  today: string;
}): Notification[] {
  const list: Notification[] = [];

  // Overdue triggers — one per overdue client
  for (const entry of rosterEntries) {
    if (entry.period.status !== "overdue") continue;

    const earliestOverdue = [...entry.period.installments]
      .filter((inst) => inst.dueDate < today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    const triggerDate = earliestOverdue?.dueDate ?? entry.period.periodStartDate;
    const daysSince = daysFromCairo(triggerDate, today);
    const key = `overdue:${entry.client.id}:${triggerDate}`;

    list.push({
      key,
      type: "overdue",
      clientId: entry.client.id,
      clientName: entry.client.name,
      message:
        daysSince <= 1
          ? "Newly overdue."
          : `Overdue for ${daysSince} day${daysSince === 1 ? "" : "s"}.`,
      firedDate: triggerDate,
      read: readState.has(key),
    });
  }

  // Stale special services — unpaid for > 30 days
  for (const s of specialServices) {
    if (s.paid) continue;
    const daysUnpaid = daysFromCairo(s.serviceDate, today);
    if (daysUnpaid <= STALE_SERVICE_DAYS) continue;

    const key = `service-stale:${s.id}`;
    list.push({
      key,
      type: "service-stale",
      clientId: s.clientId,
      clientName: s.clientName,
      serviceId: s.id,
      serviceTitle: s.title,
      message: `"${s.title}" unpaid for ${daysUnpaid} days.`,
      firedDate: s.serviceDate,
      read: readState.has(key),
    });
  }

  // Sort: unread first, then by firedDate (oldest first → most-urgent at top)
  list.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return a.firedDate.localeCompare(b.firedDate);
  });

  return list;
}
