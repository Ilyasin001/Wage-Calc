/**
 * Formatting and conversion helpers.
 *
 * All money is handled as integer pence throughout the app (spec §3);
 * these helpers are the only place pence meet display strings.
 * All timestamps are stored UTC and displayed in Europe/London (spec §6).
 */

export const TIMEZONE = "Europe/London";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

/** 123456 → "£1,234.56" */
export function formatPence(pence: number): string {
  return gbp.format(pence / 100);
}

/** "12.50" | "12" | "£12.50" → 1250; returns null for invalid or negative input */
export function parsePoundsToPence(input: string): number | null {
  const cleaned = input.trim().replace(/^£/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [pounds, fraction = ""] = cleaned.split(".");
  return Number(pounds) * 100 + Number(fraction.padEnd(2, "0") || "0");
}

/** Date → "18:00" (24-hour, Europe/London) */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(date);
}

/** Date → "Tue, 5 Aug 2025" (Europe/London) */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(date);
}

/** Date → "Tue 5 Aug, 18:00" (Europe/London) */
export function formatDateTime(date: Date): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIMEZONE,
  }).format(date)}, ${formatTime(date)}`;
}

/** 450 minutes → "7h 30m"; 420 → "7h"; 45 → "45m" */
export function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
