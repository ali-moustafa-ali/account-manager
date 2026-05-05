import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { type DerivedPeriod } from "@/lib/domain/period";
import { formatEGP } from "@/lib/utils/currency";

export function PeriodCard({ period, today }: { period: DerivedPeriod; today: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-3 mb-1">Current period</div>
          <div className="font-display text-2xl font-medium tracking-tight">
            {period.periodStartDate} → {period.periodEndDate}
          </div>
        </div>
        <StatusPill status={period.status} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <Stat label="Target" value={formatEGP(period.effectiveTarget)} />
        <Stat label="Paid" value={formatEGP(period.paidThisPeriod)} />
        <Stat label="Remaining" value={formatEGP(period.remaining)} emphasis={period.remaining > 0 ? "danger" : undefined} />
        {period.carryForwardFromPrev > 0 ? (
          <Stat label="Carried forward" value={formatEGP(period.carryForwardFromPrev)} emphasis="warning" />
        ) : (
          <Stat label="Base target" value={formatEGP(period.baseTarget)} />
        )}
      </div>

      {period.installments.length > 0 ? (
        <div className="border-t border-line pt-4">
          <div className="text-xs uppercase tracking-wider text-ink-3 mb-3">Installments</div>
          <div className="space-y-2">
            {period.installments.map((inst) => {
              const isPast = inst.dueDate < today;
              return (
                <div
                  key={inst.slot}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span className="text-ink-2">
                    Installment {inst.slot}
                    <span className="text-ink-3 ml-2">due {inst.dueDate}</span>
                    {isPast ? (
                      <span className="text-status-overdue-bg ml-2 font-medium">past</span>
                    ) : null}
                  </span>
                  <span className="text-ink-1 font-medium tabular-nums">
                    {formatEGP(inst.expectedAmount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "danger" | "warning";
}) {
  const colorClass =
    emphasis === "danger"
      ? "text-status-overdue-bg"
      : emphasis === "warning"
        ? "text-status-partial-fg"
        : "text-ink-1";
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-3 mb-1">{label}</div>
      <div className={`font-display text-xl font-medium tracking-tight tabular-nums ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}
