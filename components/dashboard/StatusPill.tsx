import { Pill } from "@/components/ui/Pill";
import { type PaymentStatus } from "@/lib/domain/status";

const labels: Record<PaymentStatus, string> = {
  cleared: "Cleared",
  partial: "Partial",
  pending: "Pending",
  overdue: "Overdue",
};

export function StatusPill({ status }: { status: PaymentStatus }) {
  return <Pill variant={status}>{labels[status]}</Pill>;
}
