import { Card } from "@/components/ui/Card";
import { formatEGP } from "@/lib/utils/currency";

export interface SummaryData {
  totalClients: number;
  totalRemaining: number;
  overdueCount: number;
  pendingCount: number;
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | number;
  emphasis?: "danger";
}) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wider text-ink-3 mb-2">{label}</div>
      <div
        className={`font-display text-3xl font-medium tracking-tight tabular-nums ${
          emphasis === "danger" ? "text-status-overdue-bg" : "text-ink-1"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

export function SummaryStrip({ data }: { data: SummaryData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Stat label="Clients" value={data.totalClients} />
      <Stat label="Outstanding" value={formatEGP(data.totalRemaining)} />
      <Stat
        label="Overdue"
        value={data.overdueCount}
        emphasis={data.overdueCount > 0 ? "danger" : undefined}
      />
      <Stat label="Pending" value={data.pendingCount} />
    </div>
  );
}
