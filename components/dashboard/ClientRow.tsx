import Link from "next/link";
import { type Client } from "@/lib/db/schema";
import { type DerivedPeriod } from "@/lib/domain/period";
import { formatEGP } from "@/lib/utils/currency";
import { StatusPill } from "./StatusPill";

export function ClientRow({ client, period }: { client: Client; period: DerivedPeriod }) {
  return (
    <tr className="border-b border-line last:border-b-0 hover:bg-surface-2/50 transition-colors">
      <td className="py-4 px-4">
        <Link
          href={`/clients/${client.id}`}
          className="text-ink-1 font-medium hover:underline"
          dir="auto"
        >
          {client.name}
        </Link>
      </td>
      <td className="py-4 px-4 text-end tabular-nums text-ink-2" dir="ltr">
        {formatEGP(client.packageCost)}
      </td>
      <td className="py-4 px-4 text-end tabular-nums text-ink-1" dir="ltr">
        {formatEGP(period.effectiveTarget)}
      </td>
      <td className="py-4 px-4 text-end tabular-nums text-ink-1" dir="ltr">
        {formatEGP(period.paidThisPeriod)}
      </td>
      <td className="py-4 px-4 text-end tabular-nums text-ink-3" dir="ltr">
        {formatEGP(client.totalAdsAmount)}
      </td>
      <td className="py-4 px-4 text-end tabular-nums text-ink-1 font-medium" dir="ltr">
        {formatEGP(period.remaining)}
      </td>
      <td className="py-4 px-4">
        <StatusPill status={period.status} />
      </td>
    </tr>
  );
}
