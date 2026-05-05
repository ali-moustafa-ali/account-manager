"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { clients, payments, credits, periods } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import type { ActionResult } from "./types";

const RecordPaymentSchema = z.object({
  clientId: z.string().uuid(),
  targetYear: z.coerce.number().int().min(2024).max(2100),
  targetMonth: z.coerce.number().int().min(1).max(12),
  slot: z.union([z.literal("1"), z.literal("2"), z.literal("credit")]),
  amount: z.coerce.number().int().min(1).max(9_999_999),
  receivedOn: z.string().date(),
  note: z.string().max(500).optional(),
});

const DeletePaymentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
});

export async function recordPayment(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();

  const parsed = RecordPaymentSchema.safeParse({
    clientId: formData.get("clientId"),
    targetYear: formData.get("targetYear"),
    targetMonth: formData.get("targetMonth"),
    slot: formData.get("slot"),
    amount: formData.get("amount"),
    receivedOn: formData.get("receivedOn"),
    note: (formData.get("note") as string) || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: {
        field: issue?.path?.[0]?.toString(),
        message: issue?.message ?? "Invalid input",
      },
    };
  }

  // Validate slot vs cycle
  const client = await db
    .select({ billingCycle: clients.billingCycle })
    .from(clients)
    .where(eq(clients.id, parsed.data.clientId))
    .limit(1);
  if (client.length === 0) {
    return { ok: false, error: { message: "Client not found" } };
  }
  if (client[0]!.billingCycle === "anchor-day" && parsed.data.slot === "2") {
    return {
      ok: false,
      error: {
        field: "slot",
        message: "Anchor-day clients have only one installment (slot 1)",
      },
    };
  }

  const slotValue =
    parsed.data.slot === "credit" ? null : (Number(parsed.data.slot) as 1 | 2);

  // Look for existing materialized period
  const existingPeriod = await db
    .select({ id: periods.id })
    .from(periods)
    .where(
      and(
        eq(periods.clientId, parsed.data.clientId),
        eq(periods.year, parsed.data.targetYear),
        eq(periods.month, parsed.data.targetMonth),
      ),
    )
    .limit(1);

  // Insert payment
  const inserted = await db
    .insert(payments)
    .values({
      clientId: parsed.data.clientId,
      periodId: existingPeriod[0]?.id ?? null,
      targetYear: parsed.data.targetYear,
      targetMonth: parsed.data.targetMonth,
      slot: slotValue,
      amount: parsed.data.amount,
      receivedOn: parsed.data.receivedOn,
      note: parsed.data.note ?? null,
    })
    .returning({ id: payments.id });

  // If targeting a future period (no period row exists), upsert credits projection
  if (existingPeriod.length === 0 && parsed.data.slot === "credit") {
    await db
      .insert(credits)
      .values({
        clientId: parsed.data.clientId,
        targetYear: parsed.data.targetYear,
        targetMonth: parsed.data.targetMonth,
        amount: parsed.data.amount,
      })
      .onConflictDoUpdate({
        target: [credits.clientId, credits.targetYear, credits.targetMonth],
        set: { amount: sql`${credits.amount} + ${parsed.data.amount}` },
      });
  }

  revalidatePath("/");
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, data: { id: inserted[0]!.id } };
}

export async function deletePayment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();

  const parsed = DeletePaymentSchema.safeParse({
    id: formData.get("id"),
    clientId: formData.get("clientId"),
  });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid input" } };
  }

  await db.delete(payments).where(eq(payments.id, parsed.data.id));
  revalidatePath("/");
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, data: undefined };
}
