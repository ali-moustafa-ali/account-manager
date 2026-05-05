"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import type { ActionResult } from "@/app/actions/types";

type Cycle = "split-month" | "anchor-day";

interface ClientFormProps {
  action: (prev: ActionResult<{ id: string }> | null, formData: FormData) => Promise<ActionResult<{ id: string }>>;
  initial?: {
    id: string;
    name: string;
    packageCost: number;
    targetCost: number;
    totalAdsAmount: number;
    billingCycle: Cycle;
    anchorDay: number | null;
    onboardedOn: string;
  };
  submitLabel?: string;
}

export function ClientForm({ action, initial, submitLabel }: ClientFormProps) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  const [billingCycle, setBillingCycle] = useState<Cycle>(initial?.billingCycle ?? "split-month");

  const errorFor = (field: string) =>
    state && !state.ok && state.error.field === field ? state.error.message : undefined;
  const generalError = state && !state.ok && !state.error.field ? state.error.message : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Input
        label="Client name"
        name="name"
        defaultValue={initial?.name ?? ""}
        required
        maxLength={80}
        error={errorFor("name")}
        dir="auto"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Package Cost (EGP)"
          name="packageCost"
          type="number"
          min={0}
          max={9_999_999}
          step={1}
          required
          defaultValue={initial?.packageCost ?? ""}
          error={errorFor("packageCost")}
          hint="Total contract value (informational)."
        />
        <Input
          label="Target Cost / period (EGP)"
          name="targetCost"
          type="number"
          min={0}
          max={9_999_999}
          step={1}
          required
          defaultValue={initial?.targetCost ?? ""}
          error={errorFor("targetCost")}
          hint="Recurring per period. Set 0 for a one-off project."
        />
      </div>

      <Input
        label="Total Ads Amount (EGP, lifetime)"
        name="totalAdsAmount"
        type="number"
        min={0}
        max={9_999_999}
        step={1}
        defaultValue={initial?.totalAdsAmount ?? 0}
        error={errorFor("totalAdsAmount")}
      />

      <fieldset>
        <legend className="text-sm font-medium text-ink-1 mb-2">Billing cycle</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-3 rounded-card border border-line bg-white px-4 py-3 cursor-pointer has-checked:border-ink-1 has-checked:bg-surface-2/50">
            <input
              type="radio"
              name="billingCycle"
              value="split-month"
              checked={billingCycle === "split-month"}
              onChange={() => setBillingCycle("split-month")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-ink-1">Split-month (50/50)</span>
              <span className="block text-xs text-ink-3 mt-0.5">
                Half on day 1, half 5 days before month-end.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-card border border-line bg-white px-4 py-3 cursor-pointer has-checked:border-ink-1 has-checked:bg-surface-2/50">
            <input
              type="radio"
              name="billingCycle"
              value="anchor-day"
              checked={billingCycle === "anchor-day"}
              onChange={() => setBillingCycle("anchor-day")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-ink-1">Anchor-day (single)</span>
              <span className="block text-xs text-ink-3 mt-0.5">
                One payment per period, on a fixed day each month.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {billingCycle === "anchor-day" ? (
        <Input
          label="Anchor day (1–28)"
          name="anchorDay"
          type="number"
          min={1}
          max={28}
          step={1}
          required
          defaultValue={initial?.anchorDay ?? 5}
          error={errorFor("anchorDay")}
          hint="Day of month when the invoice is sent and the full Target is due."
        />
      ) : null}

      {!initial ? (
        <Input
          label="Onboarded on"
          name="onboardedOn"
          type="date"
          defaultValue={undefined}
          error={errorFor("onboardedOn")}
          hint="Defaults to today (Africa/Cairo)."
        />
      ) : null}

      {generalError ? <Banner tone="danger">{generalError}</Banner> : null}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending} variant="primary">
          {pending ? "Saving…" : (submitLabel ?? (initial ? "Save changes" : "Add client"))}
        </Button>
      </div>
    </form>
  );
}
