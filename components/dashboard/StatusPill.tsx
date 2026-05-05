import { Pill } from "@/components/ui/Pill";
import { type PaymentStatus } from "@/lib/domain/status";

const labels: Record<PaymentStatus, string> = {
  cleared: "مسدّد",
  partial: "جزئي",
  pending: "قيد الانتظار",
  overdue: "متأخر",
};

export function StatusPill({ status }: { status: PaymentStatus }) {
  return <Pill variant={status}>{labels[status]}</Pill>;
}
