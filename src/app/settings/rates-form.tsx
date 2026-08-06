"use client";

import { useActionState } from "react";
import { updateRates } from "@/lib/actions/settings";
import {
  ErrorBanner,
  Field,
  PrimaryButton,
  SuccessBanner,
  TextInput,
} from "@/components/ui";

export function RatesForm({
  baseRate,
  supervisorRate,
}: {
  baseRate: string;
  supervisorRate: string;
}) {
  const [state, formAction, pending] = useActionState(withSuccess, undefined);

  async function withSuccess(
    prev: { error?: string; ok?: boolean } | undefined,
    formData: FormData,
  ): Promise<{ error?: string; ok?: boolean }> {
    const result = await updateRates(prev, formData);
    return result?.error ? { error: result.error } : { ok: true };
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorBanner>{state.error}</ErrorBanner>}
      {state?.ok && <SuccessBanner>Rates saved.</SuccessBanner>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Base rate (£/hr)">
          <TextInput
            name="baseRate"
            inputMode="decimal"
            required
            defaultValue={baseRate}
          />
        </Field>
        <Field label="Supervisor rate (£/hr)">
          <TextInput
            name="supervisorRate"
            inputMode="decimal"
            required
            defaultValue={supervisorRate}
          />
        </Field>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        New rates apply to shifts created from now on. Existing shifts keep the
        rates they were created with.
      </p>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save rates"}
      </PrimaryButton>
    </form>
  );
}
