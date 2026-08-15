"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markEntriesPaid } from "@/lib/actions/payments";
import { formatPence } from "@/lib/format";
import { EmptyState, ErrorBanner, InitialsTile } from "@/components/ui";
import { Icon } from "@/components/icon";

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

function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
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
          shiftLabel: `${shortDay(s.date)} · ${s.location} (${shortTime(s.startAt)}–${shortTime(s.endAt)})`,
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
    <div className="flex flex-col gap-4">
      {/* Date range selector */}
      <div className="flex flex-col gap-3 rounded-[8px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Icon
            name="calendar_today"
            size={20}
            className="text-on-surface-variant"
          />
          <span className="microlabel text-on-surface-variant">Pay period</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="microlabel text-[10px] text-on-surface-variant">
              From
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => e.target.value && setRange(e.target.value, to)}
              className="h-[40px] w-full rounded-[4px] border border-outline-variant bg-surface px-3 text-[14px] outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="microlabel text-[10px] text-on-surface-variant">
              To
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => e.target.value && setRange(from, e.target.value)}
              className="h-[40px] w-full rounded-[4px] border border-outline-variant bg-surface px-3 text-[14px] outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </label>
        </div>

        {days.length > 0 && (
          <div>
            <p className="microlabel mb-1.5 text-[10px] text-on-surface-variant">
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
                    className={`microlabel rounded-[4px] px-2.5 py-1.5 transition-colors ${
                      off
                        ? "bg-surface-container text-on-surface-variant line-through opacity-60"
                        : "bg-secondary/10 text-secondary"
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
          <details>
            <summary className="microlabel cursor-pointer text-[10px] text-on-surface-variant">
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
                      className={`w-full rounded-[4px] px-3 py-2 text-left text-[12px] transition-colors ${
                        off
                          ? "bg-surface-container text-on-surface-variant line-through opacity-60"
                          : "bg-secondary/10 text-on-secondary-fixed-variant"
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
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {owed.length === 0 ? (
        <EmptyState>
          Nobody is owed money for the selected days — all settled.
        </EmptyState>
      ) : (
        <>
          {/* Total outstanding + mark all */}
          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <span className="microlabel text-[12px] text-on-surface-variant">
                Total Outstanding · {owed.length} staff
              </span>
              <span className="money text-[24px] font-bold text-primary">
                {formatPence(grandTotal)}
              </span>
            </div>
            {confirmFor === "ALL" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => payEntries(allEntryIds)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[4px] bg-secondary text-[14px] font-semibold text-on-secondary disabled:opacity-50"
                >
                  {pending
                    ? "Marking…"
                    : `Confirm ALL ${formatPence(grandTotal)} paid`}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmFor(null)}
                  className="h-11 w-full rounded-[4px] border border-outline-variant text-[14px] font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmFor("ALL")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[4px] bg-secondary text-[14px] font-semibold text-on-secondary shadow-sm transition-colors duration-150 hover:bg-on-secondary-fixed-variant active:scale-95"
              >
                <Icon name="done_all" size={20} />
                Mark all paid
              </button>
            )}
          </div>

          {/* Staff owed cards */}
          <div className="flex flex-col gap-2">
            {owed.map((o) => (
              <article
                key={o.staffId}
                className="relative flex flex-col overflow-hidden rounded-[4px] border border-outline-variant bg-surface-container-lowest p-3 shadow-sm before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-error"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 pl-1">
                    <InitialsTile name={o.name} />
                    <div>
                      <h3 className="text-[14px] font-semibold leading-tight text-on-surface">
                        {o.name}
                      </h3>
                      <p className="mt-0.5 text-[12px] text-on-surface-variant">
                        {o.lines.length}{" "}
                        {o.lines.length === 1 ? "shift" : "shifts"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStaff((cur) =>
                          cur === o.staffId ? null : o.staffId,
                        )
                      }
                      className="microlabel rounded-[4px] border border-outline-variant px-3 py-1 text-[12px] text-on-surface transition-colors hover:bg-surface-container-low"
                    >
                      View
                    </button>
                    {confirmFor !== o.staffId && (
                      <button
                        type="button"
                        onClick={() => setConfirmFor(o.staffId)}
                        className="microlabel rounded-[4px] bg-surface-container-highest px-3 py-1 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary hover:text-on-secondary"
                      >
                        Pay
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between border-t border-outline-variant pt-2 pl-1">
                  <span className="text-[12px] text-on-surface-variant">
                    {hoursLabel(o.workedMinutes)}
                  </span>
                  <span className="money text-[14px] font-semibold text-primary">
                    {formatPence(o.totalPence)}
                  </span>
                </div>

                {confirmFor === o.staffId && (
                  <div className="mt-2 flex gap-2 border-t border-outline-variant pt-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => payEntries(o.entryIds)}
                      className="h-9 w-full rounded-[4px] bg-secondary text-[12px] font-semibold text-on-secondary disabled:opacity-50"
                    >
                      {pending
                        ? "Marking…"
                        : `Confirm ${formatPence(o.totalPence)} paid`}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirmFor(null)}
                      className="h-9 w-full rounded-[4px] border border-outline-variant text-[12px] font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {expandedStaff === o.staffId && (
                  <div className="mt-2 border-t border-outline-variant pt-2 pl-1 text-[12px]">
                    {o.lines.map((l) => (
                      <div
                        key={l.entryId}
                        className="flex justify-between py-1 text-on-surface-variant"
                      >
                        <span>{l.shiftLabel}</span>
                        <span className="money text-[12px]">
                          {formatPence(l.totalPence)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
