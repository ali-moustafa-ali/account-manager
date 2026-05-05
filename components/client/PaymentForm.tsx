"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import type { ActionResult } from "@/app/actions/types";

interface PaymentFormProps {
  action: (
    prev: ActionResult<{ id: string }> | null,
    formData: FormData,
  ) => Promise<ActionResult<{ id: string }>>;
  clientId: string;
  billingCycle: "split-month" | "anchor-day";
  defaultTargetYear: number;
  defaultTargetMonth: number;
  defaultReceivedOn: string;
}

export function PaymentForm({
  action,
  clientId,
  billingCycle,
  defaultTargetYear,
  defaultTargetMonth,
  defaultReceivedOn,
}: PaymentFormProps) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  const [slot, setSlot] = useState<"1" | "2" | "credit">("1");

  const errorFor = (field: string) =>
    state && !state.ok && state.error.field === field ? state.error.message : undefined;
  const generalError = state && !state.ok && !state.error.field ? state.error.message : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Input
          label="Year"
          name="targetYear"
          type="number"
          min={2024}
          max={2100}
          defaultValue={defaultTargetYear}
          required
          error={errorFor("targetYear")}
        />
        <Input
          label="Month"
          name="targetMonth"
          type="number"
          min={1}
          max={12}
          defaultValue={defaultTargetMonth}
          required
          error={errorFor("targetMonth")}
        />
        <div>
          <label htmlFor="slot" className="block text-sm font-medium text-ink-1 mb-2">
            Allocate to
          </label>
          <select
            id="slot"
            name="slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value as "1" | "2" | "credit")}
            className="w-full rounded-card border border-line bg-white px-4 py-2.5 text-ink-1 outline-none focus:ring-2 focus:ring-ink-1/30"
          >
            <option value="1">Installment 1</option>
            {billingCycle === "split-month" ? (
              <option value="2">Installment 2</option>
            ) : null}
            <option value="credit">Credit (advance)</option>
          </select>
          {errorFor("slot") ? (
            <p className="text-sm mt-2 text-status-overdue-bg font-medium">{errorFor("slot")}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Amount (EGP)"
          name="amount"
          type="number"
          min={1}
          max={9_999_999}
          step={1}
          required
          error={errorFor("amount")}
        />
        <Input
          label="Received on"
          name="receivedOn"
          type="date"
          defaultValue={defaultReceivedOn}
          required
          error={errorFor("receivedOn")}
        />
      </div>

      <Input
        label="Note (optional)"
        name="note"
        type="text"
        maxLength={500}
        error={errorFor("note")}
      />

      {generalError ? <Banner tone="danger">{generalError}</Banner> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
