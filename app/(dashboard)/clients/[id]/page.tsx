import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchClientDetail } from "@/lib/db/queries";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { PeriodCard } from "@/components/client/PeriodCard";
import { PaymentList } from "@/components/client/PaymentList";
import { CreditList } from "@/components/client/CreditList";
import { PaymentForm } from "@/components/client/PaymentForm";
import { SpecialServiceForm } from "@/components/client/SpecialServiceForm";
import { SpecialServiceList } from "@/components/client/SpecialServiceList";
import { recordPayment } from "@/app/actions/payments";
import { formatEGP } from "@/lib/utils/currency";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchClientDetail(id);
  if (!detail) notFound();

  const {
    client,
    currentPeriod,
    payments,
    credits,
    specialServices,
    specialServicesOwed,
    today,
  } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-ink-2 hover:text-ink-1 transition-colors inline-block mb-3"
        >
          ← Back to dashboard
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-3xl font-medium tracking-tight" dir="auto">
              {client.name}
            </h2>
            <p className="text-ink-2 text-sm mt-1">
              Package {formatEGP(client.packageCost)} · Total ads paid{" "}
              {formatEGP(client.totalAdsAmount)} · Cycle {client.billingCycle}
              {client.anchorDay ? ` (anchor day ${client.anchorDay})` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/clients/${id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
            <Link href={`/clients/${id}/delete`}>
              <Button variant="ghost" className="text-status-overdue-bg hover:bg-status-overdue-bg/10">
                Delete
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <PeriodCard period={currentPeriod} today={today} />

      {credits.length > 0 ? <CreditList credits={credits} /> : null}

      <section className="space-y-3">
        <h3 className="font-display text-2xl font-medium tracking-tight">Record payment</h3>
        <div className="rounded-card border border-line bg-white p-6">
          <PaymentForm
            action={recordPayment}
            clientId={id}
            billingCycle={client.billingCycle}
            defaultTargetYear={currentPeriod.year}
            defaultTargetMonth={currentPeriod.month}
            defaultReceivedOn={today}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-2xl font-medium tracking-tight">Payments</h3>
        <PaymentList payments={payments} clientId={id} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display text-2xl font-medium tracking-tight">Special services</h3>
          {specialServicesOwed > 0 ? (
            <span className="text-sm text-status-partial-fg font-medium">
              Owed: {formatEGP(specialServicesOwed)}
            </span>
          ) : null}
        </div>
        <Banner tone="info">
          Special services are billed separately from the package — they are NOT added into the
          period Remaining.
        </Banner>
        <SpecialServiceList services={specialServices} clientId={id} />
        <div className="rounded-card border border-line bg-white p-6">
          <h4 className="text-sm font-medium text-ink-1 mb-4">Add a special service</h4>
          <SpecialServiceForm clientId={id} defaultDate={today} />
        </div>
      </section>
    </div>
  );
}
