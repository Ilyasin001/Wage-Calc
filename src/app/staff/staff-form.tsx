"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/actions/staff";
import {
  ErrorBanner,
  Field,
  PrimaryButton,
  Select,
  TextInput,
} from "@/components/ui";

export interface StaffFormValues {
  name: string;
  phone: string;
  role: string;
}

export function StaffForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  initial?: StaffFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorBanner>{state.error}</ErrorBanner>}
      <Field label="Name">
        <TextInput
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name}
          autoComplete="off"
        />
      </Field>
      <Field label="Phone (optional)">
        <TextInput
          name="phone"
          type="tel"
          inputMode="tel"
          maxLength={30}
          defaultValue={initial?.phone}
          autoComplete="off"
        />
      </Field>
      <Field label="Role">
        <Select name="role" defaultValue={initial?.role ?? "regular"}>
          <option value="regular">Regular</option>
          <option value="supervisor">Supervisor</option>
          <option value="manager">Manager</option>
        </Select>
      </Field>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Role is a label only — it never changes anyone&apos;s pay. The
        supervisor rate comes from the supervisor slot on each shift.
      </p>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </PrimaryButton>
    </form>
  );
}
