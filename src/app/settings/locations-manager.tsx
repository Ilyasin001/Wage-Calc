"use client";

import { useActionState, useState } from "react";
import { createLocation, renameLocation } from "@/lib/actions/locations";
import type { ActionResult } from "@/lib/actions/staff";
import {
  EmptyState,
  ErrorBanner,
  inputClass,
  PrimaryButton,
} from "@/components/ui";

export function LocationsManager({
  locations,
}: {
  locations: { id: string; name: string }[];
}) {
  const [addState, addAction, addPending] = useActionState(
    createLocation,
    undefined,
  );

  return (
    <div className="space-y-3">
      {addState?.error && <ErrorBanner>{addState.error}</ErrorBanner>}
      <form action={addAction} className="flex gap-2">
        <input
          name="name"
          required
          maxLength={100}
          placeholder="New venue name…"
          autoComplete="off"
          className={inputClass}
          aria-label="New venue name"
        />
        <button
          type="submit"
          disabled={addPending}
          className="shrink-0 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {locations.length === 0 ? (
        <EmptyState>
          No venues yet — add the places where shifts happen.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {locations.map((loc) => (
            <LocationRow key={loc.id} id={loc.id} name={loc.name} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LocationRow({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const boundRename = renameLocation.bind(null, id);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await boundRename(prev, formData);
      if (!result?.error) setEditing(false);
      return result;
    },
    undefined,
  );

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      {editing ? (
        <form action={formAction} className="space-y-2">
          {state?.error && <ErrorBanner>{state.error}</ErrorBanner>}
          <input
            name="name"
            defaultValue={name}
            required
            maxLength={100}
            autoComplete="off"
            className={inputClass}
            aria-label={`Rename ${name}`}
          />
          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="w-full rounded-lg border border-slate-300 py-3 text-sm font-medium dark:border-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <span className="font-medium">{name}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
          >
            Rename
          </button>
        </div>
      )}
    </li>
  );
}
