import Link from "next/link";
import { fetchNotifications } from "@/lib/db/queries";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { NotificationItem } from "./NotificationItem";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await fetchNotifications();
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/"
            className="text-sm text-ink-2 hover:text-ink-1 transition-colors inline-block mb-3"
          >
            ← Back to dashboard
          </Link>
          <h2 className="font-display text-3xl font-medium tracking-tight">Notifications</h2>
          <p className="text-ink-2 mt-1">
            {unread.length} unread · {read.length} read
          </p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="font-display text-2xl font-medium tracking-tight mb-2">
            All clear
          </h3>
          <p className="text-ink-2">No overdue clients or stale special services.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {unread.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs uppercase tracking-wider text-ink-3 font-medium">
                  Unread
                </h3>
                <Pill variant="overdue">{unread.length}</Pill>
              </div>
              <Card>
                <ul className="divide-y divide-line">
                  {unread.map((n) => (
                    <NotificationItem key={n.key} notification={n} />
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}

          {read.length > 0 ? (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-ink-3 font-medium mb-3">
                Read
              </h3>
              <Card className="opacity-70">
                <ul className="divide-y divide-line">
                  {read.map((n) => (
                    <NotificationItem key={n.key} notification={n} />
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
