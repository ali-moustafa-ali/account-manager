"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { verifyPasscode } from "@/lib/auth/passcode";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/session";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { field?: string; message: string } };

const SignInSchema = z.object({
  passcode: z.string().min(4).max(64),
});

// Single-bucket rate limit: 10 failed attempts per 5 minutes app-wide.
// MVP scope is one user; this just slows down brute force on a leaked URL.
const failureBucket = { count: 0, windowStart: 0 };
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function rateLimitOk(): boolean {
  const now = Date.now();
  if (now - failureBucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    failureBucket.windowStart = now;
    failureBucket.count = 0;
  }
  return failureBucket.count < RATE_LIMIT_MAX;
}

function recordFailure(): void {
  failureBucket.count += 1;
}

export async function signIn(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = SignInSchema.safeParse({ passcode: formData.get("passcode") });
  if (!parsed.success) {
    return {
      ok: false,
      error: { field: "passcode", message: "Passcode must be 4–64 characters" },
    };
  }
  if (!rateLimitOk()) {
    return { ok: false, error: { message: "Too many attempts. Wait 5 minutes." } };
  }
  const ok = await verifyPasscode(parsed.data.passcode);
  if (!ok) {
    recordFailure();
    return { ok: false, error: { field: "passcode", message: "Invalid passcode" } };
  }
  await setSessionCookie();
  redirect("/");
}

export async function signOut(): Promise<void> {
  await clearSessionCookie();
  redirect("/sign-in");
}
