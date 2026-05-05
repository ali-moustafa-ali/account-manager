"use server";

import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { specialServices } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { todayInCairo } from "@/lib/time/cairo";
import type { ActionResult } from "./types";

const AddSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional(),
  price: z.coerce.number().int().min(0).max(9_999_999),
  serviceDate: z.string().date(),
  paid: z.coerce.boolean().default(false),
});

const ToggleSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  paid: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
});

const DeleteSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
});

export async function addSpecialService(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();

  const parsed = AddSchema.safeParse({
    clientId: formData.get("clientId"),
    title: formData.get("title"),
    description: (formData.get("description") as string) || undefined,
    price: formData.get("price"),
    serviceDate: formData.get("serviceDate"),
    paid: formData.get("paid") === "on" ? "true" : "false",
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

  const inserted = await db
    .insert(specialServices)
    .values({
      clientId: parsed.data.clientId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      serviceDate: parsed.data.serviceDate,
      paid: parsed.data.paid,
      paidOn: parsed.data.paid ? todayInCairo() : null,
    })
    .returning({ id: specialServices.id });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, data: { id: inserted[0]!.id } };
}

export async function toggleSpecialServicePaid(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();

  const parsed = ToggleSchema.safeParse({
    id: formData.get("id"),
    clientId: formData.get("clientId"),
    paid: formData.get("paid"),
  });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid input" } };
  }

  await db
    .update(specialServices)
    .set({
      paid: parsed.data.paid,
      paidOn: parsed.data.paid ? todayInCairo() : null,
      updatedAt: sql`now()`,
    })
    .where(eq(specialServices.id, parsed.data.id));

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, data: undefined };
}

export async function deleteSpecialService(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();

  const parsed = DeleteSchema.safeParse({
    id: formData.get("id"),
    clientId: formData.get("clientId"),
  });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid input" } };
  }

  await db.delete(specialServices).where(eq(specialServices.id, parsed.data.id));
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, data: undefined };
}
