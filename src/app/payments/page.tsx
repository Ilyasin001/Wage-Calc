import { prisma } from "@/lib/db";
import { shiftEntryViews } from "@/lib/shift-view";
import { addDays, mondayOf, todayLondon } from "@/lib/time";
import { PaymentsClient, type PaymentShift } from "./payments-client";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: PageProps<"/payments">) {
  const params = await searchParams;
  // Default range: the last complete pay week, Monday–Sunday (D13/A2).
  const thisMonday = mondayOf(todayLondon());
  const from =
    typeof params.from === "string" && params.from
      ? params.from
      : addDays(thisMonday, -7);
  const to =
    typeof params.to === "string" && params.to ? params.to : addDays(thisMonday, -1);

  const shifts = await prisma.shift.findMany({
    where: { date: { gte: from, lte: to } },
    include: { location: true, entries: { include: { staff: true } } },
    orderBy: [{ date: "asc" }, { startAt: "asc" }],
  });

  const payload: PaymentShift[] = shifts.map((s) => {
    const { entries } = shiftEntryViews(s, s.entries);
    return {
      shiftId: s.id,
      date: s.date,
      location: s.location.name,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      entries: entries.map((e) => ({
        entryId: e.entryId,
        staffId: e.staffId,
        name: e.name,
        workedMinutes: e.pay.workedMinutes,
        totalPence: e.pay.totalPence,
        paid: e.paid,
      })),
    };
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Payments</h1>
      <PaymentsClient from={from} to={to} shifts={payload} />
    </div>
  );
}
