"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { formatEGP } from "@/lib/utils/currency";
import {
  toggleSpecialServicePaid,
  deleteSpecialService,
} from "@/app/actions/special-services";

export interface SpecialServiceRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  serviceDate: string;
  paid: boolean;
  paidOn: string | null;
}

export function SpecialServiceList({
  services,
  clientId,
}: {
  services: SpecialServiceRow[];
  clientId: string;
}) {
  if (services.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-2 text-center">No special services yet.</p>
      </Card>
    );
  }

  const unpaid = services.filter((s) => !s.paid);
  const paid = services.filter((s) => s.paid);

  return (
    <div className="space-y-4">
      {unpaid.length > 0 ? (
        <ServiceGroup label="Unpaid" services={unpaid} clientId={clientId} />
      ) : null}
      {paid.length > 0 ? (
        <ServiceGroup label="Paid" services={paid} clientId={clientId} muted />
      ) : null}
    </div>
  );
}

function ServiceGroup({
  label,
  services,
  clientId,
  muted = false,
}: {
  label: string;
  services: SpecialServiceRow[];
  clientId: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-3 mb-2 font-medium">
        {label} ({services.length})
      </div>
      <Card className={muted ? "opacity-70" : ""}>
        <ul className="divide-y divide-line">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} clientId={clientId} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ServiceRow({
  service,
  clientId,
}: {
  service: SpecialServiceRow;
  clientId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="p-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h4 className="font-medium text-ink-1" dir="auto">
            {service.title}
          </h4>
          <span className="text-xs text-ink-3">{service.serviceDate}</span>
          {service.paid && service.paidOn ? (
            <span className="text-xs text-status-cleared-fg">paid {service.paidOn}</span>
          ) : null}
        </div>
        {service.description ? (
          <p className="text-sm text-ink-2 mt-1" dir="auto">
            {service.description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-medium tabular-nums text-ink-1">
          {formatEGP(service.price)}
        </span>
        <form
          action={(formData: FormData) => {
            startTransition(async () => {
              await toggleSpecialServicePaid(null, formData);
            });
          }}
        >
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="paid" value={service.paid ? "false" : "true"} />
          <button
            type="submit"
            disabled={pending}
            className="text-xs text-ink-2 hover:text-ink-1 disabled:opacity-50 transition-colors"
          >
            {pending ? "…" : service.paid ? "Mark unpaid" : "Mark paid"}
          </button>
        </form>
        <form
          action={(formData: FormData) => {
            startTransition(async () => {
              await deleteSpecialService(null, formData);
            });
          }}
        >
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="clientId" value={clientId} />
          <button
            type="submit"
            disabled={pending}
            className="text-xs text-ink-3 hover:text-status-overdue-bg disabled:opacity-50 transition-colors"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
