import Link from "next/link";
import { buildReportData } from "@/lib/report-data";
import { formatPence } from "@/lib/format";
import { addDays, mondayOf, todayLondon } from "@/lib/time";
import { Card, EmptyState, inputClass } from "@/components/ui";
import { Icon } from "@/components/icon";

export const metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: PageProps<"/reports">) {
  const params = await searchParams;
  const today = todayLondon();
  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, -7);

  const from =
    typeof params.from === "string" && params.from ? params.from : lastMonday;
  const to =
    typeof params.to === "string" && params.to
      ? params.to
      : addDays(thisMonday, -1);

  const data = await buildReportData(from, to);
  const query = `from=${from}&to=${to}`;

  const quickPicks = [
    { label: "Last pay week", from: lastMonday, to: addDays(thisMonday, -1) },
    { label: "This week so far", from: thisMonday, to: today },
    { label: "Yesterday", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "Today", from: today, to: today },
  ];

  return (
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="text-[20px] font-semibold text-on-surface">Reports</h1>

      <div className="flex flex-wrap gap-2">
        {quickPicks.map((q) => {
          const active = q.from === from && q.to === to;
          return (
            <Link
              key={q.label}
              href={`/reports?from=${q.from}&to=${q.to}`}
              className={`microlabel rounded-[4px] px-3 py-1.5 transition-colors ${
                active
                  ? "bg-secondary text-on-secondary"
                  : "bg-secondary/10 text-secondary"
              }`}
            >
              {q.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <form method="get" className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="microlabel text-on-surface-variant">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="microlabel text-on-surface-variant">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="col-span-2 h-[40px] rounded-[4px] border border-outline-variant text-[13px] font-semibold text-on-surface hover:bg-surface-container-low"
          >
            Apply range
          </button>
        </form>
      </Card>

      {data.shifts.length === 0 ? (
        <EmptyState>No shifts between {from} and {to}.</EmptyState>
      ) : (
        <>
          <Card>
            <span className="microlabel text-on-surface-variant">
              {from} to {to}
            </span>
            <div className="mt-2 flex items-end justify-between">
              <div className="text-[13px] text-on-surface-variant">
                <p>
                  {data.shifts.length}{" "}
                  {data.shifts.length === 1 ? "shift" : "shifts"}
                </p>
                <p>
                  {data.staffSummary.length}{" "}
                  {data.staffSummary.length === 1 ? "staff member" : "staff"}{" "}
                  worked
                </p>
              </div>
              <span className="money text-[24px] font-bold text-primary">
                {formatPence(data.grandTotalPence)}
              </span>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={`/api/reports?${query}&format=pdf`}
              className="flex h-11 items-center justify-center gap-2 rounded-[4px] bg-secondary text-[14px] font-semibold text-on-secondary shadow-sm transition-colors hover:bg-on-secondary-fixed-variant"
            >
              <Icon name="picture_as_pdf" size={20} />
              PDF
            </a>
            <a
              href={`/api/reports?${query}&format=xlsx`}
              className="flex h-11 items-center justify-center gap-2 rounded-[4px] border border-secondary text-[14px] font-semibold text-secondary transition-colors hover:bg-secondary/10"
            >
              <Icon name="table_view" size={20} />
              Excel
            </a>
          </div>
        </>
      )}
    </div>
  );
}
