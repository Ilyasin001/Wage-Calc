"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markEntriesPaid } from "@/lib/actions/payments";
import { formatMinutesAsHours, formatPence } from "@/lib/format";
import {
  Card,
  EmptyState,
  ErrorBanner,
  inputClass,
} from "@/components/ui";

export interface PaymentShift {
  shiftId: string;
  date: string; // YYYY-MM-DD
  location: string;
  startAt: string;
  endAt: string;
  entries: {
    entryId: string;
    staffId: string;
    name: string;
    workedMinutes: number;
    totalPence: number;
    paid: boolean;
  }[];
}

function shortDay(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

function shortTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

export function PaymentsClient({
  from,
  to,
  shifts,
}: {
  from: string;
  to: string;
  shifts: PaymentShift[];
}) {
  const router = useRouter();
  const [excludedDays, setExcludedDays] = useState<Set<string>>(new Set());
  const [excludedShifts, setExcludedShifts] = useState<Set<string>>(new Set());
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | "ALL" | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const days = useMemo(
    () => [...new Set(shifts.map((s) => s.date))].sort(),
    [shifts],
  );

  const included = shifts.filter(
    (s) => !excludedDays.has(s.date) && !excludedShifts.has(s.shiftId),
  );

  // Group unpaid entries by staff — only staff owed money appear (D14).
  const owed = useMemo(() => {
    const byStaff = new Map<
      string,
      {
        name: string;
        entryIds: string[];
        totalPence: number;
        workedMinutes: number;
        lines: {
          entryId: string;
          shiftLabel: string;
          workedMinutes: number;
          totalPence: number;
        }[];
      }
    >();
    for (const s of included) {
      for (const e of s.entries) {
        if (e.paid) continue;
        const cur = byStaff.get(e.staffId) ?? {
          name: e.name,
          entryIds: [],
          totalPence: 0,
          workedMinutes: 0,
          lines: [],
        };
        cur.entryIds.push(e.entryId);
        cur.totalPence += e.totalPence;
        cur.workedMinutes += e.workedMinutes;
        cur.lines.push({
          entryId: e.entryId,
          shiftLabel: `${shortDay(s.date)} · ${s.location} · ${shortTime(s.startAt)}–${shortTime(s.endAt)}`,
          workedMinutes: e.workedMinutes,
          totalPence: e.totalPence,
        });
        byStaff.set(e.staffId, cur);
      }
    }
    return [...byStaff.entries()]
      .map(([staffId, v]) => ({ staffId, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [included]);

  const grandTotal = owed.reduce((sum, o) => sum + o.totalPence, 0);
  const allEntryIds = owed.flatMap((o) => o.entryIds);

  function setRange(nextFrom: string, nextTo: string) {
    router.push(`/payments?from=${nextFrom}&to=${nextTo}`);
  }

  function toggleDay(day: string) {
    setExcludedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function toggleShift(id: string) {
    setExcludedShifts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function payEntries(ids: string[]) {
    setError(undefined);
    startTransition(async () => {
      const result = await markEntriesPaid(ids);
      if (result?.error) setError(result.error);
      setConfirmFor(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => e.target.value && setRange(e.target.value, to)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => e.target.value && setRange(from, e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {days.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium">
              Days included (tap to exclude)
            </p>
            <div className="flex flex-wrap gap-2">
              {days.map((d) => {
                const off = excludedDays.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={!off}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      off
                        ? "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                    }`}
                  >
                    {shortDay(d)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {shifts.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">
              Individual shifts (tap to exclude)
            </summary>
            <ul className="mt-2 space-y-1">
              {shifts.map((s) => {
                const dayOff = excludedDays.has(s.date);
                const off = dayOff || excludedShifts.has(s.shiftId);
                return (
                  <li key={s.shiftId}>
                    <button
                      type="button"
                      disabled={dayOff}
                      onClick={() => toggleShift(s.shiftId)}
                      aria-pressed={!off}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        off
                          ? "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500"
                          : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                      }`}
                    >
                      {shortDay(s.date)} · {s.location} ·{" "}
                      {shortTime(s.startAt)}–{shortTime(s.endAt)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </Card>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {owed.length === 0 ? (
        <EmptyState>
          Nobody is owed money for the selected days — all settled.
        </EmptyState>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
            <div>
              <p className="font-medium">Total owed</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {owed.length} staff
              </p>
            </div>
            <span className="text-lg font-bold">{formatPence(grandTotal)}</span>
          </div>

          <ul className="space-y-3">
            {owed.map((o) => (
              <li key={o.staffId}>
                <Card>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedStaff((cur) =>
                        cur === o.staffId ? null : o.staffId,
                      )
                    }
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="font-medium">{o.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {o.lines.length}{" "}
                        {o.lines.length === 1 ? "shift" : "shifts"} ·{" "}
                        {formatMinutesAsHours(o.workedMinutes)}
                      </p>
                    </div>
                    <span className="font-semibold">
                      {formatPence(o.totalPence)}
                    </span>
                  </button>

                  {expandedStaff === o.staffId && (
                    <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
                      {o.lines.map((l) => (
                        <li
                          key={l.entryId}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="text-slate-600 dark:text-slate-300">
                            {l.shiftLabel}
                          </span>
                          <span>
                            {formatMinutesAsHours(l.workedMinutes)} ·{" "}
                            {formatPence(l.totalPence)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3">
                    {confirmFor === o.staffId ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => payEntries(o.entryIds)}
                          className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {pending
                            ? "Marking…"
                            : `Confirm ${formatPence(o.totalPence)} paid`}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setConfirmFor(null)}
                          className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium dark:border-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmFor(o.staffId)}
                        className="w-full rounded-lg border border-emerald-600 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                      >
                        Mark {o.name.split(" ")[0]} paid
                      </button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {confirmFor === "ALL" ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => payEntries(allEntryIds)}
                className="w-full rounded-lg bg-emerald-700 py-3 font-medium text-white disabled:opacity-50"
              >
                {pending
                  ? "Marking…"
                  : `Confirm ALL ${formatPence(grandTotal)} paid`}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmFor(null)}
                className="w-full rounded-lg border border-slate-300 py-3 font-medium dark:border-slate-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmFor("ALL")}
              className="w-full rounded-lg bg-emerald-700 py-3 font-medium text-white hover:bg-emerald-800"
            >
              Mark all paid ({formatPence(grandTotal)})
            </button>
          )}
        </>
      )}
    </div>
  );
}
