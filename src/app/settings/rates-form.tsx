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
      {/* items-end keeps both inputs aligned if a label wraps. */}
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Base (£/hr)">
          <TextInput
            name="baseRate"
            inputMode="decimal"
            required
            defaultValue={baseRate}
          />
        </Field>
        <Field label="Supervisor (£/hr)">
          <TextInput
            name="supervisorRate"
            inputMode="decimal"
            required
            defaultValue={supervisorRate}
          />
        </Field>
      </div>
      <p className="text-[12px] text-on-surface-variant">
        New rates apply to shifts created from now on. Existing shifts keep the
        rates they were created with.
      </p>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save rates"}
      </PrimaryButton>
    </form>
  );
}
