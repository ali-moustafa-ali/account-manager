"use client";

import { useTransition } from "react";
import Link from "next/link";
import { markNotificationRead } from "@/app/actions/notifications";
import type { Notification } from "@/lib/domain/notifications";

const TYPE_LABEL: Record<Notification["type"], string> = {
  overdue: "Overdue",
  "service-stale": "Stale service",
};

export function NotificationItem({ notification }: { notification: Notification }) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="p-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-ink-3 font-medium">
            {TYPE_LABEL[notification.type]}
          </span>
          <Link
            href={`/clients/${notification.clientId}`}
            className="font-medium text-ink-1 hover:underline"
            dir="auto"
          >
            {notification.clientName}
          </Link>
          <span className="text-xs text-ink-3">since {notification.firedDate}</span>
        </div>
        <p className="text-sm text-ink-2 mt-1">{notification.message}</p>
      </div>
      {!notification.read ? (
        <form
          action={(formData: FormData) => {
            startTransition(async () => {
              await markNotificationRead(null, formData);
            });
          }}
        >
          <input type="hidden" name="notificationKey" value={notification.key} />
          <button
            type="submit"
            disabled={pending}
            className="text-xs text-ink-2 hover:text-ink-1 disabled:opacity-50 transition-colors shrink-0"
          >
            {pending ? "…" : "Mark read"}
          </button>
        </form>
      ) : null}
    </li>
  );
}
