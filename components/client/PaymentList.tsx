"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { formatEGP } from "@/lib/utils/currency";
import { deletePayment } from "@/app/actions/payments";

interface PaymentRow {
  id: string;
  amount: number;
  receivedOn: string;
  targetYear: number;
  targetMonth: number;
  slot: number | null;
  note: string | null;
}

export function PaymentList({
  payments,
  clientId,
}: {
  payments: PaymentRow[];
  clientId: string;
}) {
  if (payments.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-2 text-center">No payments recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2/50">
            <th className="py-2 px-4 text-left text-xs font-medium uppercase tracking-wider text-ink-3">
              Received
            </th>
            <th className="py-2 px-4 text-left text-xs font-medium uppercase tracking-wider text-ink-3">
              Targets
            </th>
            <th className="py-2 px-4 text-right text-xs font-medium uppercase tracking-wider text-ink-3">
              Amount
            </th>
            <th className="py-2 px-4 text-left text-xs font-medium uppercase tracking-wider text-ink-3">
              Note
            </th>
            <th className="py-2 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <PaymentRowItem key={p.id} payment={p} clientId={clientId} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PaymentRowItem({
  payment,
  clientId,
}: {
  payment: PaymentRow;
  clientId: string;
}) {
  const [pending, startTransition] = useTransition();
  const slotLabel =
    payment.slot === null ? "Credit" : `Installment ${payment.slot}`;

  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="py-3 px-4 text-ink-1">{payment.receivedOn}</td>
      <td className="py-3 px-4 text-ink-2">
        {payment.targetYear}-{String(payment.targetMonth).padStart(2, "0")}, {slotLabel}
      </td>
      <td className="py-3 px-4 text-right tabular-nums text-ink-1 font-medium">
        {formatEGP(payment.amount)}
      </td>
      <td className="py-3 px-4 text-ink-3 text-xs">{payment.note ?? "—"}</td>
      <td className="py-3 px-4 text-right">
        <form
          action={async (formData: FormData) => {
            startTransition(async () => {
              await deletePayment(null, formData);
            });
          }}
        >
          <input type="hidden" name="id" value={payment.id} />
          <input type="hidden" name="clientId" value={clientId} />
          <button
            type="submit"
            disabled={pending}
            className="text-xs text-ink-3 hover:text-status-overdue-bg disabled:opacity-50 transition-colors"
          >
            {pending ? "…" : "Delete"}
          </button>
        </form>
      </td>
    </tr>
  );
}
