/**
 * Europe/London wall-clock ↔ UTC conversion and business-date helpers.
 * The accountant thinks in London wall time; storage is UTC (spec §6).
 */
import { TIMEZONE } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC offset of Europe/London at a given instant, in milliseconds. */
export function londonOffsetMs(at: Date): number {
  const name = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/([+-])(\d{2}):(\d{2})/);
  if (!m) return 0; // "GMT" with no numeric suffix = UTC+0
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 3600 + Number(m[3]) * 60) * 1000;
}

/**
 * "2026-08-03" + "18:00" in London wall time → the UTC instant.
 * Handles BST/GMT, re-checking the offset once for instants that land
 * beside a DST transition.
 */
export function londonToUtc(dateStr: string, timeStr: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  const offset = londonOffsetMs(naive);
  let utc = new Date(naive.getTime() - offset);
  const offset2 = londonOffsetMs(utc);
  if (offset2 !== offset) utc = new Date(naive.getTime() - offset2);
  return utc;
}

/** UTC instant → "HH:mm" London wall time. */
export function utcToLondonTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(date);
}

/** UTC instant → "YYYY-MM-DD" London business date. */
export function utcToLondonDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** Today's London business date, "YYYY-MM-DD". */
export function todayLondon(): string {
  return utcToLondonDate(new Date());
}

/** "2026-08-03" + n days → "2026-08-06" (calendar arithmetic, DST-safe). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`); // noon avoids DST edge effects
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** First day of the month containing the given London date. */
export function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Monday of the week containing the given London date (pay week, D13). */
export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const back = day === 0 ? 6 : day - 1;
  return addDays(dateStr, -back);
}

/**
 * Resolve an entry time to a UTC instant relative to its shift's start.
 * Staff entry times are entered as wall clock only; for overnight shifts the
 * date is ambiguous ("01:00" — before or after midnight?). Rule: pick the
 * candidate (shift date or day after) closest to the shift's start instant.
 * This keeps every sane entry — arriving early, leaving after midnight —
 * on the intended day without asking the accountant for a date.
 */
export function resolveEntryStart(
  shiftDate: string,
  shiftStartUtc: Date,
  timeStr: string,
): Date {
  const sameDay = londonToUtc(shiftDate, timeStr);
  const nextDay = londonToUtc(addDays(shiftDate, 1), timeStr);
  return Math.abs(sameDay.getTime() - shiftStartUtc.getTime()) <=
    Math.abs(nextDay.getTime() - shiftStartUtc.getTime())
    ? sameDay
    : nextDay;
}

/**
 * Resolve an entry's end time: the first instant strictly after its start
 * with the given wall time (same day, else next day).
 */
export function resolveEntryEnd(entryStartUtc: Date, timeStr: string): Date {
  const startDate = utcToLondonDate(entryStartUtc);
  const sameDay = londonToUtc(startDate, timeStr);
  if (sameDay.getTime() > entryStartUtc.getTime()) return sameDay;
  return londonToUtc(addDays(startDate, 1), timeStr);
}
