import Link from "next/link";
import { prisma } from "@/lib/db";
import { shiftEntryViews } from "@/lib/shift-view";
import { formatDate, formatPence, formatTime } from "@/lib/format";
import { addDays, todayLondon } from "@/lib/time";
import { EmptyState } from "@/components/ui";

export default async function HomePage() {
  // Rolling last 7 days including today (A2).
  const today = todayLondon();
  const from = addDays(today, -6);
  const shifts = await prisma.shift.findMany({
    where: { date: { gte: from, lte: today } },
    include: { location: true, entries: { include: { staff: true } } },
    orderBy: [{ date: "desc" }, { startAt: "desc" }],
  });

  const cards = shifts.map((s) => {
    const { totalPence, entries } = shiftEntryViews(s, s.entries);
    return { shift: s, totalPence, staffCount: entries.length };
  });
  const weekTotal = cards.reduce((sum, c) => sum + c.totalPence, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Last 7 days</h1>
        <Link
          href="/shifts/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          New shift
        </Link>
      </div>

      {cards.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <span className="font-medium">7-day total</span>
          <span className="text-lg font-bold">{formatPence(weekTotal)}</span>
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState>
          No shifts in the last 7 days. Tap “New shift” to add one, or find
          older shifts in History.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {cards.map(({ shift, totalPence, staffCount }) => (
            <li key={shift.id}>
              <Link
                href={`/shifts/${shift.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-600 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{shift.location.name}</p>
                  <p className="font-semibold">{formatPence(totalPence)}</p>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(shift.startAt)} · {formatTime(shift.startAt)}–
                  {formatTime(shift.endAt)} · {staffCount} staff
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
