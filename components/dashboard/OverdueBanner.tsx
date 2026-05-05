import Link from "next/link";
import { Banner } from "@/components/ui/Banner";

export function OverdueBanner({ overdueCount }: { overdueCount: number }) {
  if (overdueCount < 3) return null;

  return (
    <Banner
      tone="danger"
      action={
        <Link
          href="/notifications"
          className="text-xs font-medium underline underline-offset-2"
        >
          Review now →
        </Link>
      }
    >
      {overdueCount} clients are overdue.
    </Banner>
  );
}
