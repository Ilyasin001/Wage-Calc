import { prisma } from "@/lib/db";
import { shiftBatchViews, type BatchView } from "@/lib/shift-view";

/** Shared data shape for the PDF report (D18). */

export interface ReportShift {
  id: string;
  date: string;
  location: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  baseRatePence: number;
  supervisorRatePence: number;
  batches: BatchView[];
  staffCount: number;
  totalPence: number;
}

export interface StaffSummaryRow {
  /** Two staff can share a name, so rows are identified by id. */
  staffId: string;
  name: string;
  phone: string | null;
  shiftCount: number;
  /** Time on site, break included — matches the Hours column (D24). */
  grossMinutes: number;
  basePence: number;
  additionalPence: number;
  totalPence: number;
  paidPence: number;
  unpaidPence: number;
}

export interface ReportData {
  companyName: string | null;
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
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const rows = await prisma.shift.findMany({
    where: { date: { gte: from, lte: to } },
    include: {
      location: true,
      batches: { orderBy: { position: "asc" } },
      entries: { include: { staff: true } },
    },
    orderBy: [{ date: "asc" }, { startAt: "asc" }],
  });

  const shifts: ReportShift[] = rows.map((s) => {
    const { batches, totalPence } = shiftBatchViews(s, s.batches, s.entries);
    return {
      id: s.id,
      date: s.date,
      location: s.location.name,
      description: s.description,
      startAt: s.startAt,
      endAt: s.endAt,
      baseRatePence: s.baseRatePence,
      supervisorRatePence: s.supervisorRatePence,
      batches,
      staffCount: batches.reduce((n, b) => n + b.entries.length, 0),
      totalPence,
    };
  });

  // Per-staff summary (D14): what each person is owed across the range.
  const byStaff = new Map<string, StaffSummaryRow>();
  for (const shift of shifts) {
    for (const batch of shift.batches) {
      for (const e of batch.entries) {
        const cur = byStaff.get(e.staffId) ?? {
          staffId: e.staffId,
          name: e.name,
          phone: e.phone,
          shiftCount: 0,
          grossMinutes: 0,
          basePence: 0,
          additionalPence: 0,
          totalPence: 0,
          paidPence: 0,
          unpaidPence: 0,
        };
        cur.shiftCount += 1;
        cur.grossMinutes += e.pay.grossMinutes;
        cur.basePence += e.pay.basePayPence;
        cur.additionalPence += e.pay.additionalPence;
        cur.totalPence += e.pay.totalPence;
        if (e.paid) cur.paidPence += e.pay.totalPence;
        else cur.unpaidPence += e.pay.totalPence;
        byStaff.set(e.staffId, cur);
      }
    }
  }
  const staffSummary = [...byStaff.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    companyName: settings?.companyName ?? null,
    from,
    to,
    generatedAt: new Date(),
    shifts,
    staffSummary,
    grandTotalPence: shifts.reduce((sum, s) => sum + s.totalPence, 0),
  };
}
