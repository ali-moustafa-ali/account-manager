import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ClientForm } from "@/components/client/ClientForm";
import { updateClient } from "@/app/actions/clients";
import type { ActionResult } from "@/app/actions/types";

// updateClient returns ActionResult; ClientForm expects ActionResult<{id:string}>.
// Wrap it so the form state shape matches.
async function updateClientWrapped(
  prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await updateClient(prev as ActionResult | null, formData);
  if (!result.ok) return result;
  return { ok: true, data: { id: formData.get("id") as string } };
}

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  const client = rows[0];
  if (!client) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href={`/clients/${id}`}
          className="text-sm text-ink-2 hover:text-ink-1 transition-colors inline-block mb-3"
        >
          ← Back to client
        </Link>
        <h2 className="font-display text-3xl font-medium tracking-tight">Edit client</h2>
        <p className="text-ink-2 mt-1" dir="auto">
          {client.name}
        </p>
      </div>
      <ClientForm
        action={updateClientWrapped}
        initial={{
          id: client.id,
          name: client.name,
          packageCost: client.packageCost,
          targetCost: client.targetCost,
          totalAdsAmount: client.totalAdsAmount,
          billingCycle: client.billingCycle,
          anchorDay: client.anchorDay,
          onboardedOn: client.onboardedOn,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
