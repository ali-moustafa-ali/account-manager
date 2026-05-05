import Link from "next/link";
import { ClientForm } from "@/components/client/ClientForm";
import { createClient } from "@/app/actions/clients";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-ink-2 hover:text-ink-1 transition-colors inline-block mb-3"
        >
          ← Back to dashboard
        </Link>
        <h2 className="font-display text-3xl font-medium tracking-tight">Add new client</h2>
        <p className="text-ink-2 mt-1">
          The first period opens automatically based on the cycle you choose.
        </p>
      </div>
      <ClientForm action={createClient} />
    </div>
  );
}
