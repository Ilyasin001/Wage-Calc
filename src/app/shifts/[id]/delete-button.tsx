"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions/staff";
import { ErrorBanner, SecondaryButton } from "@/components/ui";

export function DeleteShiftButton({
  shiftId,
  disabled,
  deleteAction,
}: {
  shiftId: string;
  disabled: boolean;
  deleteAction: (shiftId: string) => Promise<ActionResult>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (disabled) return null;

  return (
    <div className="space-y-2">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Delete this shift and all its entries? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteAction(shiftId);
                  if (result?.error) setError(result.error);
                })
              }
              className="w-full rounded-lg bg-red-600 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Yes, delete shift"}
            </button>
            <SecondaryButton
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-lg border border-red-200 py-3 font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete shift
        </button>
      )}
    </div>
  );
}
