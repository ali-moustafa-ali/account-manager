"use server";

import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { todayInCairo } from "@/lib/time/cairo";
import type { ActionResult } from "./types";

const ClientCoreFields = {
  name: z.string().trim().min(1).max(80),
  packageCost: z.coerce.number().int().min(0).max(9_999_999),
  targetCost: z.coerce.number().int().min(0).max(9_999_999),
  totalAdsAmount: z.coerce.number().int().min(0).max(9_999_999),
};

const CreateClientSchema = z
  .object({
    ...ClientCoreFields,
    onboardedOn: z.string().date().optional(),
    billingCycle: z.enum(["split-month", "anchor-day"]).default("split-month"),
    anchorDay: z.coerce.number().int().min(1).max(28).optional(),
  })
  .refine(
    (v) => (v.billingCycle === "anchor-day") === (v.anchorDay !== undefined),
    {
      message: "Anchor day is required for anchor-day cycle and forbidden otherwise",
      path: ["anchorDay"],
    },
  );

const UpdateClientSchema = z
  .object({
    id: z.string().uuid(),
    ...Object.fromEntries(Object.entries(ClientCoreFields).map(([k, v]) => [k, v.optional()])),
    status: z.enum(["active", "paused"]).optional(),
    billingCycle: z.enum(["split-month", "anchor-day"]).optional(),
    anchorDay: z.coerce.number().int().min(1).max(28).nullable().optional(),
  } as const);

const DeleteClientSchema = z.object({
  id: z.string().uuid(),
  confirmName: z.string(),
});

function readNumberField(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function createClient(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAuth();

  const billingCycle = (formData.get("billingCycle") as string) || "split-month";
  const raw = {
    name: formData.get("name"),
    packageCost: formData.get("packageCost") ?? 0,
    targetCost: formData.get("targetCost") ?? 0,
    totalAdsAmount: formData.get("totalAdsAmount") ?? 0,
    onboardedOn: (formData.get("onboardedOn") as string) || undefined,
    billingCycle,
    anchorDay: billingCycle === "anchor-day" ? readNumberField(formData.get("anchorDay")) : undefined,
  };

  const parsed = CreateClientSchema.safeParse(raw);
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
    .insert(clients)
    .values({
      name: parsed.data.name,
      packageCost: parsed.data.packageCost,
      targetCost: parsed.data.targetCost,
      totalAdsAmount: parsed.data.totalAdsAmount,
      billingCycle: parsed.data.billingCycle,
      anchorDay: parsed.data.anchorDay ?? null,
      onboardedOn: parsed.data.onboardedOn ?? todayInCairo(),
    })
    .returning({ id: clients.id });

  const newId = inserted[0]!.id;
  revalidatePath("/");
  redirect(`/clients/${newId}`);
}

export async function updateClient(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();

  const id = formData.get("id") as string;
  if (!id) return { ok: false, error: { message: "Missing client id" } };

  const billingCycle = (formData.get("billingCycle") as string) || undefined;
  const raw = {
    id,
    name: (formData.get("name") as string) || undefined,
    packageCost: readNumberField(formData.get("packageCost")),
    targetCost: readNumberField(formData.get("targetCost")),
    totalAdsAmount: readNumberField(formData.get("totalAdsAmount")),
    status: (formData.get("status") as string) || undefined,
    billingCycle,
    anchorDay:
      billingCycle === "split-month"
        ? null
        : billingCycle === "anchor-day"
          ? readNumberField(formData.get("anchorDay"))
          : undefined,
  };

  const parsed = UpdateClientSchema.safeParse(raw);
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

  const { id: _id, ...updates } = parsed.data;
  // Filter undefined fields so we don't overwrite with NULL
  const setObj = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(setObj).length === 0) {
    return { ok: false, error: { message: "Nothing to update" } };
  }

  await db
    .update(clients)
    .set({ ...setObj, updatedAt: sql`now()` })
    .where(eq(clients.id, id));

  revalidatePath("/");
  revalidatePath(`/clients/${id}`);
  return { ok: true, data: undefined };
}

export async function deleteClient(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();

  const parsed = DeleteClientSchema.safeParse({
    id: formData.get("id"),
    confirmName: formData.get("confirmName"),
  });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid input" } };
  }

  const existing = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, parsed.data.id))
    .limit(1);

  if (existing.length === 0) {
    return { ok: false, error: { message: "Client not found" } };
  }
  if (existing[0]!.name !== parsed.data.confirmName) {
    return {
      ok: false,
      error: { field: "confirmName", message: "Name does not match" },
    };
  }

  await db.delete(clients).where(eq(clients.id, parsed.data.id));
  revalidatePath("/");
  redirect("/");
}
