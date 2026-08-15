import Link from "next/link";
import { prisma } from "@/lib/db";
import { shiftEntryViews } from "@/lib/shift-view";
import { Card, EmptyState, inputClass } from "@/components/ui";
import { ShiftCard } from "@/components/shift-card";

export const metadata = { title: "History" };

function shortDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

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
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="text-[20px] font-semibold text-on-surface">History</h1>

      <Card>
        <form method="get" className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="microlabel text-on-surface-variant">From</span>
            <input type="date" name="from" defaultValue={from} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="microlabel text-on-surface-variant">To</span>
            <input type="date" name="to" defaultValue={to} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="microlabel text-on-surface-variant">Venue</span>
            <select name="location" defaultValue={locationId} className={`${inputClass} appearance-none`}>
              <option value="">All venues</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="microlabel text-on-surface-variant">Staff member</span>
            <select name="staff" defaultValue={staffId} className={`${inputClass} appearance-none`}>
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
            className="h-[40px] rounded-[4px] bg-secondary text-[13px] font-semibold text-on-secondary transition-colors hover:bg-on-secondary-fixed-variant"
          >
            Filter
          </button>
          <Link
            href="/history"
            className="flex h-[40px] items-center justify-center rounded-[4px] border border-outline-variant text-[13px] font-semibold text-on-surface hover:bg-surface-container-low"
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
          <p className="text-[12px] text-on-surface-variant">
            {cards.length === 300
              ? "Showing the most recent 300 shifts — narrow the filters to see older ones."
              : `${cards.length} ${cards.length === 1 ? "shift" : "shifts"}`}
          </p>
          <div className="flex flex-col gap-2">
            {cards.map(({ shift, totalPence, staffCount, fullyPaid }) => (
              <ShiftCard
                key={shift.id}
                href={`/shifts/${shift.id}`}
                location={shift.location.name}
                dateLabel={shortDate(shift.date)}
                staffCount={staffCount}
                startAt={shift.startAt}
                endAt={shift.endAt}
                totalPence={totalPence}
                fullyPaid={fullyPaid}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
