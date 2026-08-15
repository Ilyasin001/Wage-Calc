import Link from "next/link";
import { prisma } from "@/lib/db";
import { shiftEntryViews } from "@/lib/shift-view";
import { formatPence } from "@/lib/format";
import { addDays, todayLondon } from "@/lib/time";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/icon";
import { Fab } from "@/components/fab";
import { ShiftCard } from "@/components/shift-card";

function dayLetter(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "narrow",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

function shortDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

export default async function HomePage() {
  const today = todayLondon();
  const from = addDays(today, -6);
  const prevFrom = addDays(today, -13);
  const [shifts, prevShifts] = await Promise.all([
    prisma.shift.findMany({
      where: { date: { gte: from, lte: today } },
      include: { location: true, entries: { include: { staff: true } } },
      orderBy: [{ date: "desc" }, { startAt: "desc" }],
    }),
    prisma.shift.findMany({
      where: { date: { gte: prevFrom, lt: from } },
      include: { entries: { include: { staff: true } } },
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

  // Daily Spend Trend: last 7 days, today last and highlighted.
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const c of cards) {
    byDay.set(c.shift.date, (byDay.get(c.shift.date) ?? 0) + c.totalPence);
  }
  const maxDay = Math.max(1, ...byDay.values());

  return (
    <div>
      {/* Performance Dashboard hero */}
      <section className="pt-4">
        <div className="flex flex-col rounded-[8px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col">
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
                <div className="flex flex-col">
                  <span className="microlabel text-[10px] text-on-surface-variant">
                    Shifts
                  </span>
                  <span className="text-[20px] font-semibold text-on-surface">
                    {cards.length}
                  </span>
                </div>
                <Icon name="task_alt" size={20} className="text-secondary" />
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
                <Icon name="schedule" size={20} className="text-secondary" />
              </div>
            </div>
          </div>

          <div className="mt-2 border-t border-outline-variant pt-4">
            <h3 className="microlabel mb-3 text-[11px] text-on-surface-variant">
              Daily Spend Trend
            </h3>
            {/* Columns must stretch to the container's height, otherwise the
                bars' percentage heights resolve against an indefinite height
                and collapse to zero. */}
            <div className="flex h-[100px] items-stretch justify-between gap-1 px-1">
              {days.map((d) => {
                const isToday = d === today;
                const pct = Math.round(((byDay.get(d) ?? 0) / maxDay) * 100);
                return (
                  <div key={d} className="flex flex-1 flex-col items-center">
                    <div className="relative flex w-full flex-1 items-end justify-center rounded-t-sm bg-surface-container">
                      {/* Colour is bound to the token directly: the bar's
                          tone is dynamic, and a class built at runtime is
                          not reliably picked up by the CSS scanner. */}
                      <div
                        className="bar-animate w-full rounded-t-sm"
                        style={
                          {
                            "--target-height": `${pct}%`,
                            backgroundColor: isToday
                              ? "var(--color-secondary)"
                              : "var(--color-secondary-fixed-dim)",
                          } as React.CSSProperties
                        }
                      />
                    </div>
                    <span
                      className={`microlabel mt-1 text-[10px] ${
                        isToday
                          ? "font-bold text-on-surface"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {dayLetter(d)}
                    </span>
                  </div>
                );
              })}
            </div>
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
