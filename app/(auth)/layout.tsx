import { requireGuest } from "@/lib/auth/guard";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  await requireGuest();
  return <>{children}</>;
}
