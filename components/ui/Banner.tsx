import { cn } from "@/lib/utils/cn";

const tones = {
  info: "bg-surface-2 text-ink-1 border-line",
  warning: "bg-status-partial-bg text-status-partial-fg border-status-partial-fg/20",
  danger: "bg-status-overdue-bg text-status-overdue-fg border-status-overdue-bg",
} as const;

export type BannerTone = keyof typeof tones;

export function Banner({
  tone = "info",
  children,
  action,
}: {
  tone?: BannerTone;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-center justify-between rounded-card border px-4 py-3",
        tones[tone],
      )}
    >
      <div className="text-sm font-medium">{children}</div>
      {action ? <div className="ml-4">{action}</div> : null}
    </div>
  );
}
