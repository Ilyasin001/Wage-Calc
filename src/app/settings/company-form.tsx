"use client";

import { useActionState } from "react";
import { updateCompanyName } from "@/lib/actions/settings";
import {
  ErrorBanner,
  Field,
  PrimaryButton,
  SuccessBanner,
  TextInput,
} from "@/components/ui";

export function CompanyForm({ companyName }: { companyName: string }) {
  const [state, formAction, pending] = useActionState(
    async (
      prev: { error?: string; ok?: boolean } | undefined,
      formData: FormData,
    ): Promise<{ error?: string; ok?: boolean }> => {
      const result = await updateCompanyName(prev, formData);
      return result?.error ? { error: result.error } : { ok: true };
    },
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorBanner>{state.error}</ErrorBanner>}
      {state?.ok && <SuccessBanner>Company name saved.</SuccessBanner>}
      <Field label="Company name">
        <TextInput
          name="companyName"
          maxLength={120}
          defaultValue={companyName}
          placeholder="e.g. Ilyasin Events Ltd"
          autoComplete="organization"
        />
      </Field>
      <p className="text-[12px] text-on-surface-variant">
        Printed at the top of every PDF report.
      </p>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save company name"}
      </PrimaryButton>
    </form>
  );
}
