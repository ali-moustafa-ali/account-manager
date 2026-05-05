import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DeleteClientForm } from "./DeleteClientForm";

export default async function DeleteClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  const client = rows[0];
  if (!client) notFound();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <Link
          href={`/clients/${id}`}
          className="text-sm text-ink-2 hover:text-ink-1 transition-colors inline-block mb-3"
        >
          ← Back to client
        </Link>
        <h2 className="font-display text-3xl font-medium tracking-tight text-status-overdue-bg">
          Delete client
        </h2>
      </div>

      <div className="rounded-card border border-status-overdue-bg/30 bg-status-overdue-bg/5 p-6 space-y-3">
        <p className="text-ink-1 font-medium">
          Deleting <span dir="auto">"{client.name}"</span> is permanent.
        </p>
        <p className="text-ink-2 text-sm">
          All payments, credits, periods, and special services for this client will be removed.
          There is no undo. Type the client's exact name below to confirm.
        </p>
      </div>

      <DeleteClientForm clientId={id} clientName={client.name} />
    </div>
  );
}
