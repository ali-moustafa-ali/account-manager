import { cn } from "@/lib/utils/cn";

const variants = {
  cleared: "bg-status-cleared-bg text-status-cleared-fg",
  partial: "bg-status-partial-bg text-status-partial-fg",
  pending: "bg-status-pending-bg text-status-pending-fg",
  overdue: "bg-status-overdue-bg text-status-overdue-fg",
} as const;

export type PillVariant = keyof typeof variants;

export function Pill({
  variant,
  children,
  className,
}: {
  variant: PillVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium uppercase tracking-wider",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
