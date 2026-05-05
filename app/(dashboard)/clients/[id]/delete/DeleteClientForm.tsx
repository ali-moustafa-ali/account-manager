"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { deleteClient } from "@/app/actions/clients";
import type { ActionResult } from "@/app/actions/types";

export function DeleteClientForm({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    deleteClient,
    null,
  );
  const [confirmName, setConfirmName] = useState("");
  const matches = confirmName === clientName;

  const errorFor = (field: string) =>
    state && !state.ok && state.error.field === field ? state.error.message : undefined;
  const generalError = state && !state.ok && !state.error.field ? state.error.message : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={clientId} />

      <Input
        label={`Type "${clientName}" to confirm`}
        name="confirmName"
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        autoComplete="off"
        required
        error={errorFor("confirmName")}
        dir="auto"
      />

      {generalError ? <Banner tone="danger">{generalError}</Banner> : null}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="destructive"
          disabled={!matches || pending}
        >
          {pending ? "Deleting…" : "Permanently delete client"}
        </Button>
      </div>
    </form>
  );
}
