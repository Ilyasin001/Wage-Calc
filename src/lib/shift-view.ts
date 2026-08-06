import { entryPay, type EntryPay } from "@/lib/wage";

/** Computes display pay data for a shift row fetched with entries+staff. */

interface EntryRecord {
  id: string;
  staffId: string;
  isSupervisor: boolean | null;
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  additionalPence: number;
  paid: boolean;
  paidAt: Date | null;
  staff: { name: string };
}

export interface ShiftEntryView {
  entryId: string;
  staffId: string;
  name: string;
  isSupervisor: boolean;
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  paid: boolean;
  paidAt: Date | null;
  pay: EntryPay;
}

export function shiftEntryViews(
  shift: {
    baseRatePence: number;
    supervisorRatePence: number;
  },
  entries: EntryRecord[],
): { entries: ShiftEntryView[]; totalPence: number } {
  const views = entries.map((e) => ({
    entryId: e.id,
    staffId: e.staffId,
    name: e.staff.name,
    isSupervisor: e.isSupervisor === true,
    startAt: e.startAt,
    endAt: e.endAt,
    breakMinutes: e.breakMinutes,
    paid: e.paid,
    paidAt: e.paidAt,
    pay: entryPay(
      {
        startAt: e.startAt,
        endAt: e.endAt,
        breakMinutes: e.breakMinutes,
        isSupervisor: e.isSupervisor === true,
        additionalPence: e.additionalPence,
      },
      shift,
    ),
  }));
  // Supervisor first, then by name — matches how the accountant reads a sheet.
  views.sort(
    (a, b) =>
      Number(b.isSupervisor) - Number(a.isSupervisor) ||
      a.name.localeCompare(b.name),
  );
  return {
    entries: views,
    totalPence: views.reduce((sum, v) => sum + v.pay.totalPence, 0),
  };
}
