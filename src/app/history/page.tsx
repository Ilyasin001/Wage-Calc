import Link from "next/link";
import { prisma } from "@/lib/db";
import { shiftEntryViews } from "@/lib/shift-view";
import { formatDate, formatPence, formatTime } from "@/lib/format";
import { Card, EmptyState, inputClass } from "@/components/ui";

export const metadata = { title: "History" };

export default async function HistoryPage({
  searchParams,
}: PageProps<"/history">) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const locationId = typeof params.location === "string" ? params.location : "";
  const staffId = typeof params.staff === "string" ? params.staff : "";

  const [locations, staffList, shifts] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.staff.findMany({ orderBy: { name: "asc" } }),
    prisma.shift.findMany({
      where: {
        ...(from ? { date: { gte: from } } : {}),
        ...(to ? { date: { ...(from ? { gte: from } : {}), lte: to } } : {}),
        ...(locationId ? { locationId } : {}),
        ...(staffId ? { entries: { some: { staffId } } } : {}),
      },
      include: { location: true, entries: { include: { staff: true } } },
      orderBy: [{ date: "desc" }, { startAt: "desc" }],
      take: 300,
    }),
  ]);

  const cards = shifts.map((s) => {
    const { totalPence, entries } = shiftEntryViews(s, s.entries);
    return {
      shift: s,
      totalPence,
      staffCount: entries.length,
      fullyPaid: entries.length > 0 && entries.every((e) => e.paid),
    };
  });
  const filtered = from || to || locationId || staffId;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">History</h1>

      <Card>
        <form method="get" className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">From</span>
            <input type="date" name="from" defaultValue={from} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">To</span>
            <input type="date" name="to" defaultValue={to} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Venue</span>
            <select name="location" defaultValue={locationId} className={inputClass}>
              <option value="">All venues</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Staff member</span>
            <select name="staff" defaultValue={staffId} className={inputClass}>
              <option value="">All staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isActive ? "" : " (deactivated)"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Filter
          </button>
          <Link
            href="/history"
            className="rounded-lg border border-slate-300 py-2.5 text-center text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Clear
          </Link>
        </form>
      </Card>

      {cards.length === 0 ? (
        <EmptyState>
          {filtered
            ? "No shifts match these filters."
            : "No shifts recorded yet."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {cards.length === 300
              ? "Showing the most recent 300 shifts — narrow the filters to see older ones."
              : `${cards.length} ${cards.length === 1 ? "shift" : "shifts"}`}
          </p>
          <ul className="space-y-3">
            {cards.map(({ shift, totalPence, staffCount, fullyPaid }) => (
              <li key={shift.id}>
                <Link
                  href={`/shifts/${shift.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-600 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{shift.location.name}</p>
                    <p className="font-semibold">{formatPence(totalPence)}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>
                      {formatDate(shift.startAt)} · {formatTime(shift.startAt)}
                      –{formatTime(shift.endAt)} · {staffCount} staff
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        fullyPaid
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {fullyPaid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
