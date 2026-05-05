import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-1 px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-medium text-center mb-2 tracking-tight">
          Account Manager
        </h1>
        <p className="text-ink-2 text-center mb-10">Sign in to continue.</p>
        <SignInForm />
      </div>
    </main>
  );
}
