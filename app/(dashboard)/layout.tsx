import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { signOut } from "@/app/actions/auth";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <div className="min-h-screen bg-surface-1">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-ink-1 hover:text-ink-2 transition-colors"
          >
            Account Manager
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-ink-2 hover:text-ink-1 transition-colors px-3 py-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
