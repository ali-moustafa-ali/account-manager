import Link from "next/link";
import { ClientTable } from "@/components/dashboard/ClientTable";
import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import { OverdueBanner } from "@/components/dashboard/OverdueBanner";
import { Button } from "@/components/ui/Button";
import { fetchRoster } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const entries = await fetchRoster();

  const summary = {
    totalClients: entries.length,
    totalRemaining: entries.reduce((sum, e) => sum + e.period.remaining, 0),
    overdueCount: entries.filter((e) => e.period.status === "overdue").length,
    pendingCount: entries.filter((e) => e.period.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-3xl font-medium tracking-tight mb-2">
            Clients
          </h2>
          <p className="text-ink-2">
            {entries.length} active client{entries.length !== 1 ? "s" : ""}.
          </p>
        </div>
        <Link href="/clients/new">
          <Button variant="primary">+ Add client</Button>
        </Link>
      </div>

      <OverdueBanner overdueCount={summary.overdueCount} />

      <SummaryStrip data={summary} />

      <ClientTable entries={entries} />
    </div>
  );
}
