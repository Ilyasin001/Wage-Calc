"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/actions/settings";
import {
  ErrorBanner,
  Field,
  PrimaryButton,
  SuccessBanner,
  TextInput,
} from "@/components/ui";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (
      prev: { error?: string; ok?: boolean } | undefined,
      formData: FormData,
    ): Promise<{ error?: string; ok?: boolean }> => {
      const result = await changePassword(prev, formData);
      return result?.error ? { error: result.error } : { ok: true };
    },
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorBanner>{state.error}</ErrorBanner>}
      {state?.ok && <SuccessBanner>Password changed.</SuccessBanner>}
      <Field label="Current password">
        <TextInput
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      <Field label="New password (min 10 characters)">
        <TextInput
          name="newPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <TextInput
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </PrimaryButton>
    </form>
  );
}
