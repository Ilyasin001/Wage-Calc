"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionResult } from "@/lib/actions/staff";
import {
  formatMinutesAsHours,
  formatPence,
  parsePoundsToPence,
} from "@/lib/format";
import { entryPay, workedMinutes } from "@/lib/wage";
import { londonToUtc, resolveEntryEnd, resolveEntryStart } from "@/lib/time";
import { ErrorBanner, InitialsTile } from "@/components/ui";
import { Icon } from "@/components/icon";

export interface StaffOption {
  id: string;
  name: string;
  role: string;
}

export interface EntryDraft {
  staffId: string;
  isSupervisor: boolean;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  additional: string; // pounds text
}

export interface ShiftFormInitial {
  date: string;
  locationId: string;
  description: string;
  startTime: string;
  endTime: string;
  baseRate: string;
  supervisorRate: string;
  entries: EntryDraft[];
}

const DEFAULT_BREAK = 60;

const fieldClass =
  "w-full h-[40px] bg-surface rounded-[4px] border border-outline-variant text-on-surface text-[14px] outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary";

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="microlabel text-[11px] text-on-surface-variant">
      {children}
    </span>
  );
}

export function ShiftForm({
  action,
  staff,
  locations,
  initial,
  submitLabel,
  lockedStaffIds = [],
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  staff: StaffOption[];
  locations: { id: string; name: string }[];
  initial: ShiftFormInitial;
  submitLabel: string;
  lockedStaffIds?: string[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  const [date, setDate] = useState(initial.date);
  const [locationId, setLocationId] = useState(initial.locationId);
  const [newLocation, setNewLocation] = useState("");
  const [description, setDescription] = useState(initial.description);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [baseRate, setBaseRate] = useState(initial.baseRate);
  const [supervisorRate, setSupervisorRate] = useState(initial.supervisorRate);
  const [entries, setEntries] = useState<EntryDraft[]>(initial.entries);
  const [search, setSearch] = useState("");

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const locked = useMemo(() => new Set(lockedStaffIds), [lockedStaffIds]);

  const baseRatePence = parsePoundsToPence(baseRate);
  const supervisorRatePence = parsePoundsToPence(supervisorRate);

  const preview = useMemo(() => {
    if (baseRatePence === null || supervisorRatePence === null) return null;
    try {
      const shiftStart = londonToUtc(date, startTime);
      const rows = entries.map((e) => {
        const startAt = resolveEntryStart(date, shiftStart, e.startTime);
        const endAt = resolveEntryEnd(startAt, e.endTime);
        const additionalPence = parsePoundsToPence(e.additional || "0") ?? 0;
        const input = {
          startAt,
          endAt,
          breakMinutes: e.breakMinutes,
          isSupervisor: e.isSupervisor,
          additionalPence,
        };
        const minutes = workedMinutes(input);
        if (minutes <= 0) return { staffId: e.staffId, invalid: true as const };
        const pay = entryPay(input, { baseRatePence, supervisorRatePence });
        return { staffId: e.staffId, invalid: false as const, pay };
      });
      const total = rows.reduce(
        (sum, r) => sum + (r.invalid ? 0 : r.pay.totalPence),
        0,
      );
      return { rows: new Map(rows.map((r) => [r.staffId, r])), total };
    } catch {
      return null;
    }
  }, [entries, date, startTime, baseRatePence, supervisorRatePence]);

  function addStaff(id: string) {
    setEntries((prev) => [
      ...prev,
      {
        staffId: id,
        isSupervisor: false,
        startTime,
        endTime,
        breakMinutes: DEFAULT_BREAK,
        additional: "",
      },
    ]);
    setSearch("");
  }

  function removeStaff(id: string) {
    setEntries((prev) => prev.filter((e) => e.staffId !== id));
  }

  function patchEntry(id: string, patch: Partial<EntryDraft>) {
    setEntries((prev) =>
      prev.map((e) => (e.staffId === id ? { ...e, ...patch } : e)),
    );
  }

  function toggleSupervisor(id: string, checked: boolean) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.staffId === id) {
          return {
            ...e,
            isSupervisor: checked,
            breakMinutes: checked ? 0 : DEFAULT_BREAK, // supervisor break defaults to 0 (D6)
          };
        }
        if (checked && e.isSupervisor) {
          return { ...e, isSupervisor: false, breakMinutes: DEFAULT_BREAK };
        }
        return e;
      }),
    );
  }

  const chosen = new Set(entries.map((e) => e.staffId));
  const pickable = search.trim()
    ? staff.filter(
        (s) =>
          !chosen.has(s.id) &&
          s.name.toLowerCase().includes(search.toLowerCase().trim()),
      )
    : [];

  function buildPayload(): string {
    return JSON.stringify({
      date,
      locationId:
        locationId === "__new__" ? undefined : locationId || undefined,
      newLocationName:
        locationId === "__new__" ? newLocation.trim() || undefined : undefined,
      description: description.trim() || undefined,
      startTime,
      endTime,
      baseRatePence: baseRatePence ?? -1,
      supervisorRatePence: supervisorRatePence ?? -1,
      entries: entries.map((e) => ({
        staffId: e.staffId,
        isSupervisor: e.isSupervisor,
        startTime: e.startTime,
        endTime: e.endTime,
        breakMinutes: e.breakMinutes,
        additionalPence: parsePoundsToPence(e.additional || "0") ?? -1,
      })),
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 pt-4">
      {state?.error && <ErrorBanner>{state.error}</ErrorBanner>}
      <input type="hidden" name="payload" value={buildPayload()} />

      {/* Section 1: Shift details */}
      <section className="flex flex-col gap-4 rounded-[8px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <MicroLabel>Date</MicroLabel>
          <div className="relative">
            <Icon
              name="calendar_today"
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={`${fieldClass} pl-10 pr-4`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-end justify-between">
            <MicroLabel>Location</MicroLabel>
            <button
              type="button"
              onClick={() =>
                setLocationId((cur) => (cur === "__new__" ? "" : "__new__"))
              }
              className="microlabel flex items-center gap-1 text-[11px] text-secondary active:opacity-70"
            >
              <Icon name="add" size={14} />
              {locationId === "__new__" ? "Pick Existing" : "Add New"}
            </button>
          </div>
          {locationId === "__new__" ? (
            <div className="relative">
              <Icon
                name="location_on"
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                maxLength={100}
                required
                placeholder="New venue name…"
                autoComplete="off"
                className={`${fieldClass} pl-10 pr-4`}
              />
            </div>
          ) : (
            <div className="relative">
              <Icon
                name="location_on"
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
                className={`${fieldClass} appearance-none pl-10 pr-10`}
              >
                <option value="" disabled>
                  Choose venue…
                </option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <Icon
                name="arrow_drop_down"
                size={20}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ["Start Time", startTime, setStartTime],
              ["Finish Time", endTime, setEndTime],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label} className="flex flex-col gap-1">
              <MicroLabel>{label}</MicroLabel>
              <div className="relative">
                <Icon
                  name="schedule"
                  size={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  type="time"
                  step={900}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required
                  className={`${fieldClass} pl-10 pr-2`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <MicroLabel>Description (optional, appears on reports)</MicroLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            className="w-full rounded-[4px] border border-outline-variant bg-surface px-3 py-2 text-[14px] text-on-surface outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
      </section>

      {/* Section 2: Rates */}
      <section className="flex flex-col gap-3 rounded-[8px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">
          <Icon name="payments" size={20} className="text-secondary" />
          Rates for this shift
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ["Base Rate", baseRate, setBaseRate],
              ["Supervisor Rate", supervisorRate, setSupervisorRate],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label} className="flex flex-col gap-1">
              <MicroLabel>{label}</MicroLabel>
              <div className="relative">
                <span className="money absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
                  £
                </span>
                <input
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required
                  className="money h-[40px] w-full rounded-[4px] border border-transparent bg-surface-container pl-8 pr-4 text-[16px] font-bold text-on-surface outline-none focus:border-secondary"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Assign staff */}
      <section className="flex flex-col gap-3">
        <div className="mb-1 flex items-end justify-between">
          <h2 className="text-[18px] font-semibold text-on-surface">
            Assign Staff
          </h2>
          <span className="microlabel rounded-full bg-secondary-fixed px-2 py-1 text-[11px] text-on-secondary-fixed-variant">
            {entries.length} Added
          </span>
        </div>

        <div className="relative">
          <Icon
            name="search"
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active roster…"
            aria-label="Search staff to add"
            className="h-11 w-full rounded-full border border-outline-variant bg-surface-container-lowest pl-12 pr-4 text-[14px] shadow-sm outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
        {search.trim() && (
          <ul className="overflow-hidden rounded-[8px] border border-outline-variant bg-surface-container-lowest shadow-sm">
            {pickable.slice(0, 8).map((s) => (
              <li key={s.id} className="border-b border-outline-variant last:border-0">
                <button
                  type="button"
                  onClick={() => addStaff(s.id)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[14px] hover:bg-surface-container-low"
                >
                  <span>{s.name}</span>
                  <span className="microlabel text-secondary">+ Add</span>
                </button>
              </li>
            ))}
            {pickable.length === 0 && (
              <li className="px-4 py-2.5 text-[13px] text-on-surface-variant">
                {staff.length === chosen.size
                  ? "Everyone is on this shift."
                  : "No matches."}
              </li>
            )}
          </ul>
        )}

        <div className="mt-1 flex flex-col gap-2">
          {entries.length === 0 && (
            <p className="rounded-[8px] border border-dashed border-outline-variant p-6 text-center text-[13px] text-on-surface-variant">
              Search the roster above to add staff.
            </p>
          )}
          {entries.map((e) => {
            const person = staffById.get(e.staffId);
            const row = preview?.rows.get(e.staffId);
            const isLocked = locked.has(e.staffId);
            return (
              <article
                key={e.staffId}
                className={`flex flex-col gap-3 rounded-[4px] border border-outline-variant bg-surface-container-lowest p-3 shadow-sm ${
                  e.isSupervisor ? "border-l-4 border-l-secondary" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <InitialsTile
                      name={person?.name ?? "?"}
                      tone={e.isSupervisor ? "blue" : "neutral"}
                    />
                    <div>
                      <h3 className="flex items-center gap-1 text-[14px] font-semibold leading-tight text-on-surface">
                        {person?.name ?? "Unknown"}
                        {e.isSupervisor && (
                          <Icon
                            name="verified"
                            size={16}
                            className="text-secondary"
                          />
                        )}
                      </h3>
                      <p
                        className={`microlabel mt-0.5 text-[11px] ${
                          e.isSupervisor
                            ? "font-semibold text-secondary"
                            : "text-on-surface-variant"
                        }`}
                      >
                        {isLocked
                          ? "Paid — Locked"
                          : e.isSupervisor
                            ? "Supervisor Role"
                            : "Crew Member"}
                      </p>
                    </div>
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      aria-label={`Remove ${person?.name}`}
                      onClick={() => removeStaff(e.staffId)}
                      className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-outline transition-colors hover:text-error"
                    >
                      <Icon name="close" size={20} />
                    </button>
                  )}
                </div>

                <fieldset
                  disabled={isLocked}
                  className="flex flex-col gap-3 border-t border-outline-variant pt-2 disabled:opacity-60"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["Start", e.startTime, "startTime"],
                        ["Finish", e.endTime, "endTime"],
                      ] as const
                    ).map(([label, value, key]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <span className="microlabel text-[10px] text-on-surface-variant">
                          {label}
                        </span>
                        <input
                          type="time"
                          step={900}
                          value={value}
                          onChange={(ev) =>
                            patchEntry(e.staffId, { [key]: ev.target.value })
                          }
                          className="h-8 w-full rounded-[4px] border border-outline-variant bg-surface px-2 text-center text-[14px] outline-none focus:border-secondary"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-12 items-end gap-3">
                    <div className="col-span-4 flex flex-col gap-1">
                      <span className="microlabel text-[10px] text-on-surface-variant">
                        Break (m)
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={15}
                        value={e.breakMinutes}
                        onChange={(ev) =>
                          patchEntry(e.staffId, {
                            breakMinutes: Math.max(
                              0,
                              Number(ev.target.value) || 0,
                            ),
                          })
                        }
                        className="money h-8 w-full rounded-[4px] border border-outline-variant bg-surface px-2 text-center text-[14px] outline-none focus:border-secondary"
                      />
                    </div>
                    <div className="col-span-4 flex flex-col gap-1">
                      <span className="microlabel text-[10px] text-on-surface-variant">
                        Extra (£)
                      </span>
                      <input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={e.additional}
                        onChange={(ev) =>
                          patchEntry(e.staffId, { additional: ev.target.value })
                        }
                        className="money h-8 w-full rounded-[4px] border border-outline-variant bg-surface px-2 text-center text-[14px] outline-none focus:border-secondary"
                      />
                    </div>
                    <div className="col-span-4 flex h-full flex-col items-end justify-end gap-1 pb-0.5 pr-1">
                      <span className="microlabel whitespace-nowrap text-[10px] text-on-surface-variant">
                        Sup?
                      </span>
                      <input
                        type="checkbox"
                        className="toggle mt-1"
                        checked={e.isSupervisor}
                        aria-label={`${person?.name} is supervisor`}
                        onChange={(ev) =>
                          toggleSupervisor(e.staffId, ev.target.checked)
                        }
                      />
                    </div>
                  </div>
                </fieldset>

                <div className="flex items-center justify-end border-t border-outline-variant pt-2 text-[12px]">
                  {row && !row.invalid ? (
                    <span className="text-on-surface-variant">
                      {formatMinutesAsHours(row.pay.workedMinutes)} ·{" "}
                      <span className="money text-[13px] text-on-surface">
                        {formatPence(row.pay.totalPence)}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium text-error">
                      Check times/break
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Sticky footer: live total + save */}
      <div className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-between border-t border-outline-variant bg-surface-container-lowest px-5 py-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col">
          <span className="microlabel text-[11px] text-on-surface-variant">
            Est. Total Pay
          </span>
          <span className="money mt-1 text-[24px] font-bold leading-none tracking-tight text-on-surface">
            {preview ? formatPence(preview.total) : "—"}
          </span>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="microlabel flex h-11 items-center gap-2 rounded-full bg-secondary px-6 text-[14px] font-semibold text-on-secondary shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
          <Icon name="task_alt" size={20} />
        </button>
      </div>
      <div className="h-16" />
    </form>
  );
}
