import Link from "next/link";
import { buildReportData } from "@/lib/report-data";
import { formatPence } from "@/lib/format";
import { addDays, mondayOf, todayLondon } from "@/lib/time";
import { Card, EmptyState, inputClass } from "@/components/ui";

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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>

      <div className="flex flex-wrap gap-2">
        {quickPicks.map((q) => {
          const active = q.from === from && q.to === to;
          return (
            <Link
              key={q.label}
              href={`/reports?from=${q.from}&to=${q.to}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {q.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <form method="get" className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="col-span-2 rounded-lg border border-slate-300 py-2.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
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
            <p className="font-medium">
              {from} to {to}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <li>{data.shifts.length} shifts</li>
              <li>{data.staffSummary.length} staff worked</li>
              <li className="font-semibold text-slate-900 dark:text-slate-100">
                Grand total {formatPence(data.grandTotalPence)}
              </li>
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={`/api/reports?${query}&format=pdf`}
              className="rounded-lg bg-emerald-700 py-3 text-center font-medium text-white hover:bg-emerald-800"
            >
              Download PDF
            </a>
            <a
              href={`/api/reports?${query}&format=xlsx`}
              className="rounded-lg border border-emerald-700 py-3 text-center font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
            >
              Download Excel
            </a>
          </div>
        </>
      )}
    </div>
  );
}
