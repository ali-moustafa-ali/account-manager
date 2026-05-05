import { Card } from "@/components/ui/Card";
import { formatEGP } from "@/lib/utils/currency";

interface Credit {
  targetYear: number;
  targetMonth: number;
  amount: number;
}

export function CreditList({ credits }: { credits: Credit[] }) {
  const positive = credits.filter((c) => c.amount > 0);
  if (positive.length === 0) return null;

  return (
    <Card className="p-5 border-status-partial-fg/20 bg-status-partial-bg/40">
      <div className="text-xs uppercase tracking-wider text-status-partial-fg mb-2 font-medium">
        Credits toward future periods
      </div>
      <ul className="space-y-1">
        {positive.map((c) => (
          <li
            key={`${c.targetYear}-${c.targetMonth}`}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-ink-1">
              {c.targetYear}-{String(c.targetMonth).padStart(2, "0")}
            </span>
            <span className="font-medium tabular-nums text-status-partial-fg">
              {formatEGP(c.amount)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
