/**
 * The wage engine — pure functions only, no I/O (spec §3).
 *
 * Invariants enforced here:
 *  - all money is integer pence; rounding is half-up to the nearest penny
 *  - times land on 15-minute boundaries (D2)
 *  - breaks are whole 5-minute steps (D22)
 *  - an entry ending "before" it starts is invalid — overnight entries are
 *    represented with real timestamps (endAt on the next calendar day), so
 *    endAt > startAt always holds for valid data (D9)
 *  - nobody may work outside their shift's window (D23)
 */

export const TIME_STEP_MINUTES = 15;
export const BREAK_STEP_MINUTES = 5;

export interface EntryInput {
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  isSupervisor: boolean;
  additionalPence: number;
}

export interface ShiftRates {
  baseRatePence: number;
  supervisorRatePence: number;
}

export interface EntryPay {
  /** Paid minutes — break deducted. Drives base pay. */
  workedMinutes: number;
  /** Time on site including break. Display only (reports, D24). */
  grossMinutes: number;
  ratePence: number;
  basePayPence: number;
  additionalPence: number;
  totalPence: number;
}

export type EntryIssue =
  | "start-not-on-15-minute-boundary"
  | "end-not-on-15-minute-boundary"
  | "end-not-after-start"
  | "negative-break"
  | "break-not-on-5-minute-step"
  | "break-consumes-entire-time"
  | "negative-additional"
  | "outside-shift-window";

/** The shift window an entry or batch must fall inside (D23). */
export interface Window {
  startAt: Date;
  endAt: Date;
}

/**
 * Validation issues for a single entry; empty array = valid.
 * Pass the shift window to also enforce that nobody works outside it.
 */
export function validateEntry(entry: EntryInput, shift?: Window): EntryIssue[] {
  const issues: EntryIssue[] = [];
  if (!onQuarterHour(entry.startAt)) issues.push("start-not-on-15-minute-boundary");
  if (!onQuarterHour(entry.endAt)) issues.push("end-not-on-15-minute-boundary");
  if (entry.endAt.getTime() <= entry.startAt.getTime()) {
    issues.push("end-not-after-start");
  }
  if (entry.breakMinutes < 0) issues.push("negative-break");
  else {
    if (!Number.isInteger(entry.breakMinutes / BREAK_STEP_MINUTES)) {
      issues.push("break-not-on-5-minute-step");
    }
    if (
      entry.endAt.getTime() > entry.startAt.getTime() &&
      spanMinutes(entry) - entry.breakMinutes <= 0
    ) {
      issues.push("break-consumes-entire-time");
    }
  }
  if (entry.additionalPence < 0) issues.push("negative-additional");
  if (shift && !withinWindow(entry, shift)) issues.push("outside-shift-window");
  return issues;
}

/** True when [inner) lies entirely inside [outer]; touching edges are fine. */
export function withinWindow(inner: Window, outer: Window): boolean {
  return (
    inner.startAt.getTime() >= outer.startAt.getTime() &&
    inner.endAt.getTime() <= outer.endAt.getTime()
  );
}

export type BatchIssue =
  | "start-not-on-15-minute-boundary"
  | "end-not-on-15-minute-boundary"
  | "end-not-after-start"
  | "outside-shift-window";

/** Validation issues for a batch's own times; empty array = valid. */
export function validateBatch(batch: Window, shift: Window): BatchIssue[] {
  const issues: BatchIssue[] = [];
  if (!onQuarterHour(batch.startAt)) issues.push("start-not-on-15-minute-boundary");
  if (!onQuarterHour(batch.endAt)) issues.push("end-not-on-15-minute-boundary");
  if (batch.endAt.getTime() <= batch.startAt.getTime()) {
    issues.push("end-not-after-start");
  }
  if (!withinWindow(batch, shift)) issues.push("outside-shift-window");
  return issues;
}

export type RatesIssue = "base-rate-not-positive" | "supervisor-rate-not-positive";

export function validateRates(rates: ShiftRates): RatesIssue[] {
  const issues: RatesIssue[] = [];
  if (!Number.isInteger(rates.baseRatePence) || rates.baseRatePence <= 0) {
    issues.push("base-rate-not-positive");
  }
  if (
    !Number.isInteger(rates.supervisorRatePence) ||
    rates.supervisorRatePence <= 0
  ) {
    issues.push("supervisor-rate-not-positive");
  }
  return issues;
}

/** Paid minutes for an entry: elapsed span minus unpaid break (D6). */
export function workedMinutes(entry: EntryInput): number {
  return spanMinutes(entry) - entry.breakMinutes;
}

/**
 * Total time on site, break included. Reports show this as "Hours" (D24);
 * pay is always calculated from workedMinutes, which deducts the break.
 */
export function grossMinutes(entry: { startAt: Date; endAt: Date }): number {
  return spanMinutes(entry);
}

/**
 * Base pay in pence: workedMinutes/60 × rate, rounded half-up to the penny.
 * Integer arithmetic throughout — no floating point (spec §3).
 */
export function basePayPence(minutes: number, ratePence: number): number {
  return divideRoundHalfUp(minutes * ratePence, 60);
}

/** Full pay breakdown for one entry. Assumes the entry has passed validation. */
export function entryPay(entry: EntryInput, rates: ShiftRates): EntryPay {
  const minutes = workedMinutes(entry);
  const ratePence = entry.isSupervisor
    ? rates.supervisorRatePence
    : rates.baseRatePence;
  const base = basePayPence(minutes, ratePence);
  return {
    workedMinutes: minutes,
    grossMinutes: spanMinutes(entry),
    ratePence,
    basePayPence: base,
    additionalPence: entry.additionalPence,
    totalPence: base + entry.additionalPence,
  };
}

/** Shift total = sum of entry totals (spec §3). */
export function shiftTotalPence(
  entries: EntryInput[],
  rates: ShiftRates,
): number {
  return entries.reduce((sum, e) => sum + entryPay(e, rates).totalPence, 0);
}

/**
 * True when two time ranges overlap. Touching boundaries (one ends exactly
 * when the other starts) is NOT an overlap — a staff member may finish one
 * shift at 17:00 and start another at 17:00 (D10/D11).
 */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function spanMinutes(entry: { startAt: Date; endAt: Date }): number {
  return (entry.endAt.getTime() - entry.startAt.getTime()) / 60_000;
}

function onQuarterHour(date: Date): boolean {
  const ms = date.getTime();
  return ms % (TIME_STEP_MINUTES * 60_000) === 0 && ms === Math.trunc(ms);
}

/** Integer division rounding half-up (0.5p rounds to 1p). */
function divideRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}
