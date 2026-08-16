import Link from "next/link";
import { prisma } from "@/lib/db";
import { shiftEntryViews } from "@/lib/shift-view";
import { entryPay } from "@/lib/wage";
import { formatPence } from "@/lib/format";
import { addDays, monthStart, todayLondon } from "@/lib/time";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/icon";
import { Fab } from "@/components/fab";
import { ShiftCard } from "@/components/shift-card";

function shortDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

function monthLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

export default async function HomePage() {
  const today = todayLondon();
  const from = addDays(today, -6);
  const prevFrom = addDays(today, -13);
  const firstOfMonth = monthStart(today);

  const [shifts, prevShifts, monthShifts, unpaidEntries] = await Promise.all([
    prisma.shift.findMany({
      where: { date: { gte: from, lte: today } },
      include: { location: true, entries: { include: { staff: true } } },
      orderBy: [{ date: "desc" }, { startAt: "desc" }],
    }),
    prisma.shift.findMany({
      where: { date: { gte: prevFrom, lt: from } },
      include: { entries: { include: { staff: true } } },
    }),
    prisma.shift.findMany({
      where: { date: { gte: firstOfMonth, lte: today } },
      include: { entries: { include: { staff: true } } },
    }),
    // Everything still owed, across all time (D14).
    prisma.shiftEntry.findMany({
      where: { paid: false },
      include: {
        staff: { select: { id: true, name: true } },
        shift: {
          select: { baseRatePence: true, supervisorRatePence: true },
        },
      },
    }),
  ]);

  const cards = shifts.map((s) => {
    const { totalPence, entries } = shiftEntryViews(s, s.entries);
    return {
      shift: s,
      totalPence,
      staffCount: entries.length,
      workedMinutes: entries.reduce((sum, e) => sum + e.pay.workedMinutes, 0),
      fullyPaid: entries.length > 0 && entries.every((e) => e.paid),
    };
  });

  const weekTotal = cards.reduce((sum, c) => sum + c.totalPence, 0);
  const staffHours = Math.round(
    cards.reduce((sum, c) => sum + c.workedMinutes, 0) / 60,
  );
  const prevTotal = prevShifts.reduce(
    (sum, s) => sum + shiftEntryViews(s, s.entries).totalPence,
    0,
  );
  const trendPct =
    prevTotal > 0 ? ((weekTotal - prevTotal) / prevTotal) * 100 : null;

  const monthTotal = monthShifts.reduce(
    (sum, s) => sum + shiftEntryViews(s, s.entries).totalPence,
    0,
  );

  // Largest amount still owed to any one staff member.
  const owedByStaff = new Map<string, { name: string; pence: number }>();
  for (const e of unpaidEntries) {
    const pay = entryPay(
      {
        startAt: e.startAt,
        endAt: e.endAt,
        breakMinutes: e.breakMinutes,
        isSupervisor: e.isSupervisor === true,
        additionalPence: e.additionalPence,
      },
      e.shift,
    );
    const cur = owedByStaff.get(e.staffId) ?? { name: e.staff.name, pence: 0 };
    cur.pence += pay.totalPence;
    owedByStaff.set(e.staffId, cur);
  }
  const owedRanked = [...owedByStaff.values()].sort((a, b) => b.pence - a.pence);
  const topOwed = owedRanked[0] ?? null;
  const totalOwed = owedRanked.reduce((sum, o) => sum + o.pence, 0);

  return (
    <div>
      {/* Performance dashboard hero */}
      <section className="pt-4">
        <div className="flex flex-col rounded-[8px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-4">
            {/* Centred so the headline figure sits level with the tiles
                beside it, with or without a trend line. */}
            <div className="flex flex-col justify-center">
              <span className="microlabel mb-1 text-on-surface-variant">
                7-Day Spend
              </span>
              <div className="money text-[28px] font-bold leading-8 text-on-surface">
                {formatPence(weekTotal)}
              </div>
              {trendPct !== null && (
                // Green for a rise (as designed); a fall is shown neutral
                // rather than red — lower payroll spend is not an error.
                <div
                  className={`mt-1 flex items-center ${
                    trendPct >= 0
                      ? "text-tertiary-fixed-dim"
                      : "text-on-surface-variant"
                  }`}
                >
                  <Icon
                    name={trendPct >= 0 ? "trending_up" : "trending_down"}
                    size={16}
                    className="mr-1"
                  />
                  <span className="microlabel text-[11px]">
                    {trendPct >= 0 ? "+" : ""}
                    {trendPct.toFixed(1)}% vs last week
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-rows-2 gap-2">
              <div className="flex items-center justify-between rounded-[4px] bg-surface-container p-2">
                <div className="flex min-w-0 flex-col">
                  <span className="microlabel text-[10px] text-on-surface-variant">
                    Shifts
                  </span>
                  <span className="flex items-baseline gap-1 text-[20px] font-semibold leading-6 text-on-surface">
                    {monthShifts.length}
                    <span className="text-[10px] font-normal text-on-surface-variant">
                      this month
                    </span>
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {cards.length} in last 7 days
                  </span>
                </div>
                <Icon name="task_alt" size={20} className="shrink-0 text-secondary" />
              </div>
              <div className="flex items-center justify-between rounded-[4px] bg-surface-container p-2">
                <div className="flex flex-col">
                  <span className="microlabel text-[10px] text-on-surface-variant">
                    Staff Hours
                  </span>
                  <span className="text-[20px] font-semibold text-on-surface">
                    {staffHours}
                  </span>
                </div>
                <Icon name="schedule" size={20} className="shrink-0 text-secondary" />
              </div>
            </div>
          </div>

          {/* Monthly spend + largest outstanding, in place of the old chart */}
          <div className="grid grid-cols-2 gap-3 border-t border-outline-variant pt-4">
            <div className="flex flex-col">
              <span className="microlabel text-[11px] text-on-surface-variant">
                {monthLabel(today)} spend
              </span>
              <span className="money mt-1 text-[18px] font-bold text-on-surface">
                {formatPence(monthTotal)}
              </span>
              <span className="text-[10px] text-on-surface-variant">
                since {shortDate(firstOfMonth)}
              </span>
            </div>

            <Link href="/payments" className="flex min-w-0 flex-col">
              <span className="microlabel text-[11px] text-on-surface-variant">
                Largest owed
              </span>
              {topOwed ? (
                <>
                  <span className="money mt-1 text-[18px] font-bold text-error">
                    {formatPence(topOwed.pence)}
                  </span>
                  {/* Name and running total on separate lines — together they
                      truncate mid-figure at 375px. */}
                  <span className="truncate text-[10px] text-on-surface-variant">
                    {topOwed.name}
                  </span>
                  {owedRanked.length > 1 && (
                    <span className="text-[10px] text-on-surface-variant">
                      {formatPence(totalOwed)} owed in total
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="money mt-1 text-[18px] font-bold text-success">
                    {formatPence(0)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    All settled
                  </span>
                </>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* Recent shifts */}
      <div className="mb-2 mt-6 flex items-end justify-between">
        <h2 className="text-[18px] font-semibold text-on-surface">
          Recent Shifts
        </h2>
        <Link
          href="/history"
          className="microlabel py-1 text-secondary hover:underline"
        >
          View All
        </Link>
      </div>

      {cards.length === 0 ? (
        <EmptyState>
          No shifts in the last 7 days. Tap + to add one, or find older shifts
          in History.
        </EmptyState>
      ) : (
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
      )}

      <Fab href="/shifts/new" label="New shift" />
    </div>
  );
}
