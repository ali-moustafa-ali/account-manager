"use server";

import { z } from "zod";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { notificationReadState } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import type { ActionResult } from "./types";

const MarkReadSchema = z.object({
  notificationKey: z.string().min(1).max(128),
});

const MarkAllReadSchema = z.object({
  keys: z.array(z.string().min(1).max(128)).max(500),
});

export async function markNotificationRead(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();

  const parsed = MarkReadSchema.safeParse({
    notificationKey: formData.get("notificationKey"),
  });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid input" } };
  }

  await db
    .insert(notificationReadState)
    .values({ notificationKey: parsed.data.notificationKey })
    .onConflictDoUpdate({
      target: [notificationReadState.notificationKey],
      set: { readAt: sql`now()` },
    });

  revalidatePath("/");
  revalidatePath("/notifications");
  return { ok: true, data: undefined };
}

export async function markAllNotificationsRead(
  keys: string[],
): Promise<ActionResult> {
  await requireAuth();

  const parsed = MarkAllReadSchema.safeParse({ keys });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid input" } };
  }
  if (parsed.data.keys.length === 0) {
    return { ok: true, data: undefined };
  }

  await db
    .insert(notificationReadState)
    .values(parsed.data.keys.map((k) => ({ notificationKey: k })))
    .onConflictDoUpdate({
      target: [notificationReadState.notificationKey],
      set: { readAt: sql`now()` },
    });

  revalidatePath("/");
  revalidatePath("/notifications");
  return { ok: true, data: undefined };
}
