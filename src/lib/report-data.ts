import { prisma } from "@/lib/db";
import { shiftEntryViews, type ShiftEntryView } from "@/lib/shift-view";

/** Shared data shape for PDF and XLSX reports (D18). */

export interface ReportShift {
  id: string;
  date: string;
  location: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  baseRatePence: number;
  supervisorRatePence: number;
  entries: ShiftEntryView[];
  totalPence: number;
}

export interface StaffSummaryRow {
  name: string;
  shiftCount: number;
  workedMinutes: number;
  basePence: number;
  additionalPence: number;
  totalPence: number;
  paidPence: number;
  unpaidPence: number;
}

export interface ReportData {
  from: string;
  to: string;
  generatedAt: Date;
  shifts: ReportShift[];
  staffSummary: StaffSummaryRow[];
  grandTotalPence: number;
}

export async function buildReportData(
  from: string,
  to: string,
): Promise<ReportData> {
  const rows = await prisma.shift.findMany({
    where: { date: { gte: from, lte: to } },
    include: { location: true, entries: { include: { staff: true } } },
    orderBy: [{ date: "asc" }, { startAt: "asc" }],
  });

  const shifts: ReportShift[] = rows.map((s) => {
    const { entries, totalPence } = shiftEntryViews(s, s.entries);
    return {
      id: s.id,
      date: s.date,
      location: s.location.name,
      description: s.description,
      startAt: s.startAt,
      endAt: s.endAt,
      baseRatePence: s.baseRatePence,
      supervisorRatePence: s.supervisorRatePence,
      entries,
      totalPence,
    };
  });

  // Per-staff weekly summary (D14/answer 5): what each person is owed overall.
  const byStaff = new Map<string, StaffSummaryRow>();
  for (const shift of shifts) {
    for (const e of shift.entries) {
      const cur = byStaff.get(e.staffId) ?? {
        name: e.name,
        shiftCount: 0,
        workedMinutes: 0,
        basePence: 0,
        additionalPence: 0,
        totalPence: 0,
        paidPence: 0,
        unpaidPence: 0,
      };
      cur.shiftCount += 1;
      cur.workedMinutes += e.pay.workedMinutes;
      cur.basePence += e.pay.basePayPence;
      cur.additionalPence += e.pay.additionalPence;
      cur.totalPence += e.pay.totalPence;
      if (e.paid) cur.paidPence += e.pay.totalPence;
      else cur.unpaidPence += e.pay.totalPence;
      byStaff.set(e.staffId, cur);
    }
  }
  const staffSummary = [...byStaff.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    from,
    to,
    generatedAt: new Date(),
    shifts,
    staffSummary,
    grandTotalPence: shifts.reduce((sum, s) => sum + s.totalPence, 0),
  };
}
