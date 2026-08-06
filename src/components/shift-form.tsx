"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionResult } from "@/lib/actions/staff";
import { formatMinutesAsHours, formatPence, parsePoundsToPence } from "@/lib/format";
import { entryPay, workedMinutes } from "@/lib/wage";
import { londonToUtc, resolveEntryEnd, resolveEntryStart } from "@/lib/time";
import {
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  inputClass,
  PrimaryButton,
  Select,
  TextInput,
} from "@/components/ui";

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
  additional: string; // pounds text, parsed on change/submit
}

export interface ShiftFormInitial {
  date: string;
  locationId: string;
  description: string;
  startTime: string;
  endTime: string;
  baseRate: string; // pounds
  supervisorRate: string; // pounds
  entries: EntryDraft[];
}

const DEFAULT_BREAK = 60;

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
  /** Staff whose entries are paid — their rows are locked (A4). */
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
  const [pickerOpen, setPickerOpen] = useState(initial.entries.length === 0);
  const [search, setSearch] = useState("");

  const staffById = useMemo(
    () => new Map(staff.map((s) => [s.id, s])),
    [staff],
  );
  const locked = useMemo(() => new Set(lockedStaffIds), [lockedStaffIds]);

  const baseRatePence = parsePoundsToPence(baseRate);
  const supervisorRatePence = parsePoundsToPence(supervisorRate);

  // Live pay preview using the same engine the server uses (spec §3).
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
        const pay = entryPay(input, {
          baseRatePence,
          supervisorRatePence,
        });
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
  }

  function removeStaff(id: string) {
    setEntries((prev) => prev.filter((e) => e.staffId !== id));
  }

  function patchEntry(id: string, patch: Partial<EntryDraft>) {
    setEntries((prev) =>
      prev.map((e) => (e.staffId === id ? { ...e, ...patch } : e)),
    );
  }

  function setSupervisor(id: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.staffId === id
          ? { ...e, isSupervisor: true, breakMinutes: 0 } // supervisor default break 0 (D6)
          : e.isSupervisor
            ? { ...e, isSupervisor: false, breakMinutes: DEFAULT_BREAK }
            : e,
      ),
    );
  }

  const chosen = new Set(entries.map((e) => e.staffId));
  const pickable = staff.filter(
    (s) =>
      !chosen.has(s.id) &&
      s.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

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
    <form action={formAction} className="space-y-5">
      {state?.error && <ErrorBanner>{state.error}</ErrorBanner>}
      <input type="hidden" name="payload" value={buildPayload()} />

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <TextInput
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Venue">
              <Select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Choose…
                </option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
                <option value="__new__">+ New venue…</option>
              </Select>
            </Field>
          </div>
          {locationId === "__new__" && (
            <Field label="New venue name">
              <TextInput
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                maxLength={100}
                required
                autoComplete="off"
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shift start">
              <TextInput
                type="time"
                step={900}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </Field>
            <Field label="Shift finish">
              <TextInput
                type="time"
                step={900}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base rate (£/hr)">
              <TextInput
                inputMode="decimal"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                required
              />
            </Field>
            <Field label="Supervisor rate (£/hr)">
              <TextInput
                inputMode="decimal"
                value={supervisorRate}
                onChange={(e) => setSupervisorRate(e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Description (optional, appears on reports)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={2}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">
            Staff on this shift ({entries.length})
          </h2>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
          >
            {pickerOpen ? "Done adding" : "Add staff"}
          </button>
        </div>

        {pickerOpen && (
          <Card>
            <input
              type="search"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
              aria-label="Search staff to add"
            />
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
              {pickable.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => addStaff(s.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  >
                    <span>{s.name}</span>
                    <span className="text-sm text-emerald-700 dark:text-emerald-400">
                      + Add
                    </span>
                  </button>
                </li>
              ))}
              {pickable.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-500">
                  {staff.length === chosen.size
                    ? "Everyone is on this shift."
                    : "No matches."}
                </li>
              )}
            </ul>
          </Card>
        )}

        {entries.length === 0 ? (
          <div className="mt-2">
            <EmptyState>No staff added yet.</EmptyState>
          </div>
        ) : (
          <ul className="mt-2 space-y-3">
            {entries.map((e) => {
              const person = staffById.get(e.staffId);
              const row = preview?.rows.get(e.staffId);
              const isLocked = locked.has(e.staffId);
              return (
                <li key={e.staffId}>
                  <Card>
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {person?.name ?? "Unknown"}
                        {e.isSupervisor && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            Supervisor
                          </span>
                        )}
                        {isLocked && (
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Paid — locked
                          </span>
                        )}
                      </p>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => removeStaff(e.staffId)}
                          className="text-sm text-red-600 dark:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <fieldset
                      disabled={isLocked}
                      className="mt-3 grid grid-cols-2 gap-3 disabled:opacity-60"
                    >
                      <Field label="Start">
                        <TextInput
                          type="time"
                          step={900}
                          value={e.startTime}
                          onChange={(ev) =>
                            patchEntry(e.staffId, { startTime: ev.target.value })
                          }
                        />
                      </Field>
                      <Field label="Finish">
                        <TextInput
                          type="time"
                          step={900}
                          value={e.endTime}
                          onChange={(ev) =>
                            patchEntry(e.staffId, { endTime: ev.target.value })
                          }
                        />
                      </Field>
                      <Field label="Break (minutes)">
                        <TextInput
                          type="number"
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
                        />
                      </Field>
                      <Field label="Additional (£)">
                        <TextInput
                          inputMode="decimal"
                          placeholder="0.00"
                          value={e.additional}
                          onChange={(ev) =>
                            patchEntry(e.staffId, {
                              additional: ev.target.value,
                            })
                          }
                        />
                      </Field>
                    </fieldset>

                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="supervisorPick"
                          checked={e.isSupervisor}
                          disabled={isLocked}
                          onChange={() => setSupervisor(e.staffId)}
                          className="size-4 accent-emerald-700"
                        />
                        Supervisor
                      </label>
                      <p className="text-sm">
                        {row && !row.invalid ? (
                          <>
                            <span className="text-slate-500 dark:text-slate-400">
                              {formatMinutesAsHours(row.pay.workedMinutes)} ·{" "}
                            </span>
                            <span className="font-semibold">
                              {formatPence(row.pay.totalPence)}
                            </span>
                          </>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">
                            Check times/break
                          </span>
                        )}
                      </p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="sticky bottom-20 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
        <div className="flex items-center justify-between">
          <span className="font-medium">Shift total</span>
          <span className="text-lg font-bold">
            {preview ? formatPence(preview.total) : "—"}
          </span>
        </div>
      </div>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </PrimaryButton>
    </form>
  );
}
