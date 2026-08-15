"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revertEntryUnpaid } from "@/lib/actions/payments";

/**
 * Paid entries are locked (A4); tapping the badge offers the deliberate
 * revert-to-unpaid step that unlocks editing. Unpaid entries show a plain
 * badge.
 */
export function PaidBadge({
  entryId,
  paid,
}: {
  entryId: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!paid) {
    return (
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
        Unpaid
      </p>
    );
  }

  if (confirming) {
    return (
      <span className="flex gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await revertEntryUnpaid(entryId);
              setConfirming(false);
              router.refresh();
            })
          }
          className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "…" : "Revert to unpaid"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-[4px] border border-outline-variant px-2 py-1 text-[11px]"
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="microlabel text-[11px] text-success underline decoration-dotted"
      title="Tap to revert to unpaid"
    >
      Paid
    </button>
  );
}
