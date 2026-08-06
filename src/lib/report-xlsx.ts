import ExcelJS from "exceljs";
import { formatTime } from "@/lib/format";
import type { ReportData } from "@/lib/report-data";

const GBP_FORMAT = '£#,##0.00';

/**
 * Two sheets: "Shifts" (one row per staff entry, grouped under shift
 * headers) and "Staff summary" (one row per person). Money cells are real
 * numbers with a £ format so the accountant can run their own formulas.
 */
export async function renderReportXlsx(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = data.generatedAt;

  const shifts = wb.addWorksheet("Shifts");
  shifts.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Venue", key: "venue", width: 22 },
    { header: "Name", key: "name", width: 22 },
    { header: "Supervisor", key: "supervisor", width: 11 },
    { header: "Start", key: "start", width: 8 },
    { header: "Finish", key: "finish", width: 8 },
    { header: "Break (min)", key: "brk", width: 11 },
    { header: "Hours", key: "hours", width: 8 },
    { header: "Rate (£/hr)", key: "rate", width: 11 },
    { header: "Base pay (£)", key: "base", width: 12 },
    { header: "Additional (£)", key: "extra", width: 13 },
    { header: "Total (£)", key: "total", width: 12 },
    { header: "Paid", key: "paid", width: 8 },
    { header: "Description", key: "description", width: 30 },
  ];
  shifts.getRow(1).font = { bold: true };

  for (const s of data.shifts) {
    for (const e of s.entries) {
      shifts.addRow({
        date: s.date,
        venue: s.location,
        name: e.name,
        supervisor: e.isSupervisor ? "Yes" : "",
        start: formatTime(e.startAt),
        finish: formatTime(e.endAt),
        brk: e.breakMinutes,
        hours: e.pay.workedMinutes / 60,
        rate: e.pay.ratePence / 100,
        base: e.pay.basePayPence / 100,
        extra: e.pay.additionalPence / 100,
        total: e.pay.totalPence / 100,
        paid: e.paid ? "Yes" : "No",
        description: s.description ?? "",
      });
    }
    const totalRow = shifts.addRow({
      name: `Shift total — ${s.location} ${s.date}`,
      total: s.totalPence / 100,
    });
    totalRow.font = { bold: true };
  }
  const grandRow = shifts.addRow({
    name: `GRAND TOTAL (${data.shifts.length} shifts)`,
    total: data.grandTotalPence / 100,
  });
  grandRow.font = { bold: true };
  for (const col of ["rate", "base", "extra", "total"]) {
    shifts.getColumn(col).numFmt = GBP_FORMAT;
  }

  const summary = wb.addWorksheet("Staff summary");
  summary.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Shifts", key: "shifts", width: 8 },
    { header: "Hours", key: "hours", width: 8 },
    { header: "Base pay (£)", key: "base", width: 12 },
    { header: "Additional (£)", key: "extra", width: 13 },
    { header: "Total (£)", key: "total", width: 12 },
    { header: "Paid (£)", key: "paid", width: 12 },
    { header: "Still owed (£)", key: "unpaid", width: 13 },
  ];
  summary.getRow(1).font = { bold: true };
  for (const s of data.staffSummary) {
    summary.addRow({
      name: s.name,
      shifts: s.shiftCount,
      hours: s.workedMinutes / 60,
      base: s.basePence / 100,
      extra: s.additionalPence / 100,
      total: s.totalPence / 100,
      paid: s.paidPence / 100,
      unpaid: s.unpaidPence / 100,
    });
  }
  const sumRow = summary.addRow({
    name: "TOTAL",
    total: data.grandTotalPence / 100,
  });
  sumRow.font = { bold: true };
  for (const col of ["base", "extra", "total", "paid", "unpaid"]) {
    summary.getColumn(col).numFmt = GBP_FORMAT;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
