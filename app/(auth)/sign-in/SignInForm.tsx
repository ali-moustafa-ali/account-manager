"use client";

import { useActionState } from "react";
import { signIn, type ActionResult } from "@/app/actions/auth";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    signIn,
    null,
  );

  const errorMessage = state && !state.ok ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="passcode" className="block text-sm font-medium text-ink-1 mb-2">
          Passcode
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-card border border-line bg-white px-4 py-3 text-ink-1 outline-none focus:ring-2 focus:ring-ink-1/30 focus:border-ink-1/30"
          aria-describedby={errorMessage ? "passcode-error" : undefined}
          aria-invalid={errorMessage ? "true" : undefined}
        />
        {errorMessage && (
          <p
            id="passcode-error"
            role="alert"
            className="text-sm mt-2 text-status-overdue-bg font-medium"
          >
            {errorMessage}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-pill bg-ink-1 text-surface-1 font-medium py-3 hover:bg-ink-2 disabled:opacity-50 transition-colors"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
