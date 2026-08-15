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
import { StaffPicker, type PickableStaff } from "@/components/staff-picker";

export type StaffOption = PickableStaff;

export interface EntryDraft {
  staffId: string;
  isSupervisor: boolean;
  /** Empty means "use the batch times" — the common case. */
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  additional: string; // pounds text
}

export interface BatchDraft {
  key: string;
  name: string;
  startTime: string;
  endTime: string;
  entries: EntryDraft[];
}

export interface ShiftFormInitial {
  date: string;
  locationId: string;
  description: string;
  startTime: string;
  endTime: string;
  baseRate: string;
  supervisorRate: string;
  batches: BatchDraft[];
}

const DEFAULT_BREAK = 60;
const SUPERVISOR_BREAK = 0;

const fieldClass =
  "w-full h-[40px] bg-surface rounded-[4px] border border-outline-variant text-on-surface text-[14px] outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary";

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="microlabel text-[11px] text-on-surface-variant">
      {children}
    </span>
  );
}

let batchKeySeed = 0;
function newBatchKey(): string {
  batchKeySeed += 1;
  return `b${batchKeySeed}`;
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
  const [batches, setBatches] = useState<BatchDraft[]>(
    initial.batches.length > 0
      ? initial.batches
      : [
          {
            key: newBatchKey(),
            name: "",
            startTime: initial.startTime,
            endTime: initial.endTime,
            entries: [],
          },
        ],
  );
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const locked = useMemo(() => new Set(lockedStaffIds), [lockedStaffIds]);

  const baseRatePence = parsePoundsToPence(baseRate);
  const supervisorRatePence = parsePoundsToPence(supervisorRate);

  const onShift = useMemo(
    () => new Set(batches.flatMap((b) => b.entries.map((e) => e.staffId))),
    [batches],
  );

  /** Live pay preview using the same engine the server uses (spec §3). */
  const preview = useMemo(() => {
    if (baseRatePence === null || supervisorRatePence === null) return null;
    try {
      const shiftStart = londonToUtc(date, startTime);
      const rows = new Map<
        string,
        { invalid: true } | { invalid: false; pay: ReturnType<typeof entryPay> }
      >();
      let total = 0;
      const batchTotals = new Map<string, number>();

      for (const b of batches) {
        const batchStart = resolveEntryStart(date, shiftStart, b.startTime);
        const batchEnd = resolveEntryEnd(batchStart, b.endTime);
        let batchTotal = 0;
        for (const e of b.entries) {
          const startAt = e.startTime
            ? resolveEntryStart(date, batchStart, e.startTime)
            : batchStart;
          const endAt = e.endTime
            ? resolveEntryEnd(startAt, e.endTime)
            : batchEnd;
          const additionalPence = parsePoundsToPence(e.additional || "0") ?? 0;
          const input = {
            startAt,
            endAt,
            breakMinutes: e.breakMinutes,
            isSupervisor: e.isSupervisor,
            additionalPence,
          };
          if (endAt <= startAt || workedMinutes(input) <= 0) {
            rows.set(e.staffId, { invalid: true });
            continue;
          }
          const pay = entryPay(input, { baseRatePence, supervisorRatePence });
          rows.set(e.staffId, { invalid: false, pay });
          batchTotal += pay.totalPence;
        }
        batchTotals.set(b.key, batchTotal);
        total += batchTotal;
      }
      return { rows, total, batchTotals };
    } catch {
      return null;
    }
  }, [batches, date, startTime, baseRatePence, supervisorRatePence]);

  function patchBatch(key: string, patch: Partial<BatchDraft>) {
    setBatches((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    );
  }

  function addBatch() {
    setBatches((prev) => [
      ...prev,
      {
        key: newBatchKey(),
        name: "",
        startTime,
        endTime,
        entries: [],
      },
    ]);
  }

  function removeBatch(key: string) {
    setBatches((prev) => prev.filter((b) => b.key !== key));
  }

  function addStaffToBatch(key: string, ids: string[]) {
    setBatches((prev) =>
      prev.map((b) =>
        b.key === key
          ? {
              ...b,
              entries: [
                ...b.entries,
                ...ids.map((id) => ({
                  staffId: id,
                  isSupervisor: false,
                  startTime: null,
                  endTime: null,
                  breakMinutes: DEFAULT_BREAK,
                  additional: "",
                })),
              ],
            }
          : b,
      ),
    );
    setPickerFor(null);
  }

  function patchEntry(staffId: string, patch: Partial<EntryDraft>) {
    setBatches((prev) =>
      prev.map((b) => ({
        ...b,
        entries: b.entries.map((e) =>
          e.staffId === staffId ? { ...e, ...patch } : e,
        ),
      })),
    );
  }

  function removeEntry(staffId: string) {
    setBatches((prev) =>
      prev.map((b) => ({
        ...b,
        entries: b.entries.filter((e) => e.staffId !== staffId),
      })),
    );
  }

  /** Exactly one supervisor per shift (D5), across all batches. */
  function setSupervisor(staffId: string, checked: boolean) {
    setBatches((prev) =>
      prev.map((b) => ({
        ...b,
        entries: b.entries.map((e) => {
          if (e.staffId === staffId) {
            return {
              ...e,
              isSupervisor: checked,
              breakMinutes: checked ? SUPERVISOR_BREAK : DEFAULT_BREAK,
            };
          }
          if (checked && e.isSupervisor) {
            return { ...e, isSupervisor: false, breakMinutes: DEFAULT_BREAK };
          }
          return e;
        }),
      })),
    );
  }

  function toggleExpanded(staffId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  }

  /** Applies one break value to every non-supervisor in the batch. */
  function applyBreakToBatch(key: string, minutes: number) {
    setBatches((prev) =>
      prev.map((b) =>
        b.key === key
          ? {
              ...b,
              entries: b.entries.map((e) =>
                e.isSupervisor ? e : { ...e, breakMinutes: minutes },
              ),
            }
          : b,
      ),
    );
  }

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
      batches: batches.map((b) => ({
        name: b.name.trim() || undefined,
        startTime: b.startTime,
        endTime: b.endTime,
        entries: b.entries.map((e) => ({
          staffId: e.staffId,
          isSupervisor: e.isSupervisor,
          // Blank overrides fall back to the batch's own times.
          startTime: e.startTime || b.startTime,
          endTime: e.endTime || b.endTime,
          breakMinutes: e.breakMinutes,
          additionalPence: parsePoundsToPence(e.additional || "0") ?? -1,
        })),
      })),
    });
  }

  const totalStaff = batches.reduce((n, b) => n + b.entries.length, 0);

  return (
    <>
      {pickerFor && (
        <StaffPicker
          staff={staff}
          alreadyOnShift={onShift}
          title="Add staff to batch"
          onCancel={() => setPickerFor(null)}
          onAdd={(ids) => addStaffToBatch(pickerFor, ids)}
        />
      )}

      <form action={formAction} className="flex flex-col gap-4 pt-4">
        {state?.error && <ErrorBanner>{state.error}</ErrorBanner>}
        <input type="hidden" name="payload" value={buildPayload()} />

        {/* Shift details */}
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
                aria-label="Date"
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
                ["Shift Start", startTime, setStartTime],
                ["Shift Finish", endTime, setEndTime],
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
                    aria-label={label}
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
          <p className="text-[11px] text-on-surface-variant">
            Nobody can start before or finish after the shift&apos;s own times.
          </p>

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

        {/* Rates */}
        <section className="flex flex-col gap-3 rounded-[8px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">
            <Icon name="payments" size={20} className="text-secondary" />
            Rates for this shift
          </h2>
          <div className="grid grid-cols-2 items-end gap-4">
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
                    aria-label={label}
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

        {/* Batches */}
        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between">
            <h2 className="text-[18px] font-semibold text-on-surface">
              Batches
            </h2>
            <span className="microlabel rounded-full bg-secondary-fixed px-2 py-1 text-[11px] text-on-secondary-fixed-variant">
              {batches.length} · {totalStaff} staff
            </span>
          </div>

          {batches.map((b, index) => {
            const batchTotal = preview?.batchTotals.get(b.key) ?? 0;
            const hasLocked = b.entries.some((e) => locked.has(e.staffId));
            return (
              <div
                key={b.key}
                className="flex flex-col gap-3 rounded-[8px] border border-outline-variant bg-surface-container-lowest p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={b.name}
                    onChange={(e) => patchBatch(b.key, { name: e.target.value })}
                    placeholder={`Batch ${index + 1}`}
                    maxLength={60}
                    aria-label={`Name for batch ${index + 1}`}
                    className="min-w-0 flex-1 rounded-[4px] border border-transparent bg-transparent px-1 py-1 text-[15px] font-semibold text-on-surface outline-none placeholder:text-on-surface focus:border-outline-variant focus:bg-surface"
                  />
                  {batches.length > 1 && !hasLocked && (
                    <button
                      type="button"
                      onClick={() => removeBatch(b.key)}
                      aria-label={`Remove batch ${index + 1}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-outline hover:text-error"
                    >
                      <Icon name="close" size={20} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["Batch Start", b.startTime, "startTime"],
                      ["Batch Finish", b.endTime, "endTime"],
                    ] as const
                  ).map(([label, value, key]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <span className="microlabel text-[10px] text-on-surface-variant">
                        {label}
                      </span>
                      <input
                        type="time"
                        aria-label={label}
                        step={900}
                        value={value}
                        onChange={(ev) =>
                          patchBatch(b.key, { [key]: ev.target.value })
                        }
                        className="h-9 w-full rounded-[4px] border border-outline-variant bg-surface px-2 text-center text-[14px] outline-none focus:border-secondary"
                      />
                    </div>
                  ))}
                </div>

                {b.entries.length > 0 && (
                  <div className="flex items-center justify-between gap-2 border-t border-outline-variant pt-2">
                    <label className="flex items-center gap-2">
                      <span className="microlabel text-[10px] text-on-surface-variant">
                        Break all
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        defaultValue={DEFAULT_BREAK}
                        onChange={(ev) =>
                          applyBreakToBatch(
                            b.key,
                            Math.max(0, Number(ev.target.value) || 0),
                          )
                        }
                        aria-label={`Set break for everyone in batch ${index + 1}`}
                        className="money h-8 w-16 rounded-[4px] border border-outline-variant bg-surface px-2 text-center text-[13px] outline-none focus:border-secondary"
                      />
                      <span className="text-[11px] text-on-surface-variant">
                        min
                      </span>
                    </label>
                    <span className="money text-[13px] font-semibold text-on-surface">
                      {formatPence(batchTotal)}
                    </span>
                  </div>
                )}

                <ul className="flex flex-col divide-y divide-outline-variant/60">
                  {b.entries.map((e) => {
                    const person = staffById.get(e.staffId);
                    const row = preview?.rows.get(e.staffId);
                    const isLocked = locked.has(e.staffId);
                    const isOpen = expanded.has(e.staffId);
                    const custom = Boolean(e.startTime || e.endTime);
                    return (
                      <li key={e.staffId} className="py-2">
                        <div className="flex items-center gap-2">
                          <InitialsTile
                            name={person?.name ?? "?"}
                            tone={e.isSupervisor ? "blue" : "neutral"}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 truncate text-[14px] font-medium text-on-surface">
                              {person?.name ?? "Unknown"}
                              {e.isSupervisor && (
                                <Icon
                                  name="verified"
                                  size={14}
                                  className="text-secondary"
                                />
                              )}
                            </p>
                            <p className="truncate text-[11px] text-on-surface-variant">
                              {isLocked ? (
                                "Paid — locked"
                              ) : row && !row.invalid ? (
                                <>
                                  {formatMinutesAsHours(row.pay.workedMinutes)}
                                  {custom && " · custom times"}
                                </>
                              ) : (
                                <span className="text-error">
                                  Check times/break
                                </span>
                              )}
                            </p>
                          </div>
                          <span className="money shrink-0 text-[13px] font-semibold text-on-surface">
                            {row && !row.invalid
                              ? formatPence(row.pay.totalPence)
                              : "—"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(e.staffId)}
                            aria-expanded={isOpen}
                            aria-label={`Edit ${person?.name}`}
                            className="flex size-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
                          >
                            <Icon name={isOpen ? "close" : "edit"} size={18} />
                          </button>
                        </div>

                        {isOpen && (
                          <fieldset
                            disabled={isLocked}
                            className="mt-2 flex flex-col gap-2 rounded-[4px] bg-surface-container-low p-2 disabled:opacity-60"
                          >
                            <div className="grid grid-cols-3 gap-2">
                              <div className="flex flex-col gap-1">
                                <span className="microlabel text-[10px] text-on-surface-variant">
                                  Break (m)
                                </span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  aria-label={`Break for ${person?.name}`}
                                  min={0}
                                  step={5}
                                  value={e.breakMinutes}
                                  onChange={(ev) =>
                                    patchEntry(e.staffId, {
                                      breakMinutes: Math.max(
                                        0,
                                        Number(ev.target.value) || 0,
                                      ),
                                    })
                                  }
                                  className="money h-8 w-full rounded-[4px] border border-outline-variant bg-surface px-2 text-center text-[13px] outline-none focus:border-secondary"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="microlabel text-[10px] text-on-surface-variant">
                                  Extra (£)
                                </span>
                                <input
                                  inputMode="decimal"
                                  aria-label={`Extra for ${person?.name}`}
                                  placeholder="0.00"
                                  value={e.additional}
                                  onChange={(ev) =>
                                    patchEntry(e.staffId, {
                                      additional: ev.target.value,
                                    })
                                  }
                                  className="money h-8 w-full rounded-[4px] border border-outline-variant bg-surface px-2 text-center text-[13px] outline-none focus:border-secondary"
                                />
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <span className="microlabel text-[10px] text-on-surface-variant">
                                  Sup?
                                </span>
                                <input
                                  type="checkbox"
                                  className="toggle mt-1"
                                  checked={e.isSupervisor}
                                  aria-label={`${person?.name} is supervisor`}
                                  onChange={(ev) =>
                                    setSupervisor(e.staffId, ev.target.checked)
                                  }
                                />
                              </div>
                            </div>

                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={custom}
                                onChange={(ev) =>
                                  patchEntry(e.staffId, {
                                    startTime: ev.target.checked
                                      ? b.startTime
                                      : null,
                                    endTime: ev.target.checked
                                      ? b.endTime
                                      : null,
                                  })
                                }
                                className="size-4 accent-[#0051d5]"
                              />
                              <span className="text-[12px] text-on-surface-variant">
                                Different times to the batch
                              </span>
                            </label>

                            {custom && (
                              <div className="grid grid-cols-2 gap-2">
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
                                      aria-label={`${label} for ${person?.name}`}
                                      step={900}
                                      value={value ?? ""}
                                      onChange={(ev) =>
                                        patchEntry(e.staffId, {
                                          [key]: ev.target.value,
                                        })
                                      }
                                      className="h-8 w-full rounded-[4px] border border-outline-variant bg-surface px-2 text-center text-[13px] outline-none focus:border-secondary"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => removeEntry(e.staffId)}
                                className="microlabel self-start text-error"
                              >
                                Remove from shift
                              </button>
                            )}
                          </fieldset>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="button"
                  onClick={() => setPickerFor(b.key)}
                  className="flex h-10 items-center justify-center gap-1 rounded-[4px] border border-dashed border-outline-variant text-[13px] font-semibold text-secondary"
                >
                  <Icon name="add" size={18} />
                  Add staff to this batch
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addBatch}
            className="flex h-11 items-center justify-center gap-1 rounded-[4px] border border-secondary text-[14px] font-semibold text-secondary"
          >
            <Icon name="add" size={18} />
            Add another batch
          </button>
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
    </>
  );
}
