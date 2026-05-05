"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { addSpecialService } from "@/app/actions/special-services";
import type { ActionResult } from "@/app/actions/types";

export function SpecialServiceForm({
  clientId,
  defaultDate,
}: {
  clientId: string;
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(addSpecialService, null);

  const errorFor = (field: string) =>
    state && !state.ok && state.error.field === field ? state.error.message : undefined;
  const generalError = state && !state.ok && !state.error.field ? state.error.message : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />

      <Input
        label="Service title"
        name="title"
        type="text"
        required
        maxLength={120}
        error={errorFor("title")}
        placeholder="e.g. Logo redesign, Video edit, Extra landing page"
      />

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-ink-1 mb-2">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={1000}
          className="w-full rounded-card border border-line bg-white px-4 py-2.5 text-ink-1 outline-none focus:ring-2 focus:ring-ink-1/30 resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Price (EGP)"
          name="price"
          type="number"
          min={0}
          max={9_999_999}
          step={1}
          required
          error={errorFor("price")}
        />
        <Input
          label="Service date"
          name="serviceDate"
          type="date"
          defaultValue={defaultDate}
          required
          error={errorFor("serviceDate")}
        />
        <div className="flex items-end pb-2.5">
          <label className="inline-flex items-center gap-2 text-sm text-ink-1 cursor-pointer">
            <input type="checkbox" name="paid" className="rounded border-line" />
            <span>Already paid</span>
          </label>
        </div>
      </div>

      {generalError ? <Banner tone="danger">{generalError}</Banner> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add service"}
      </Button>
    </form>
  );
}
