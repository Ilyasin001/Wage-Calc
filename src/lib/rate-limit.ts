/**
 * In-memory login rate limiter: 5 failed attempts per key per 15 minutes
 * (spec §7). In-process state — sufficient for a single-instance deployment;
 * a serverless multi-instance deployment would move this to the database.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, recent);
  return recent.length < MAX_FAILURES;
}

export function recordFailedLogin(key: string): void {
  const list = failures.get(key) ?? [];
  list.push(Date.now());
  failures.set(key, list);
}

export function resetLoginRateLimit(key: string): void {
  failures.delete(key);
}
