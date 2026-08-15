import { entryPay, type EntryPay } from "@/lib/wage";

/** Computes display pay data for a shift fetched with batches/entries/staff. */

interface EntryRecord {
  id: string;
  batchId: string;
  staffId: string;
  isSupervisor: boolean | null;
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  additionalPence: number;
  paid: boolean;
  paidAt: Date | null;
  staff: { name: string; phone?: string | null };
}

interface BatchRecord {
  id: string;
  name: string | null;
  position: number;
  startAt: Date;
  endAt: Date;
}

export interface ShiftEntryView {
  entryId: string;
  batchId: string;
  staffId: string;
  name: string;
  phone: string | null;
  isSupervisor: boolean;
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  paid: boolean;
  paidAt: Date | null;
  pay: EntryPay;
}

export interface BatchView {
  batchId: string;
  label: string;
  name: string | null;
  position: number;
  startAt: Date;
  endAt: Date;
  entries: ShiftEntryView[];
  totalPence: number;
}

/** "Batch 2" unless the accountant named it. */
export function batchLabel(name: string | null, position: number): string {
  return name?.trim() ? name.trim() : `Batch ${position}`;
}

export function shiftEntryViews(
  shift: { baseRatePence: number; supervisorRatePence: number },
  entries: EntryRecord[],
): { entries: ShiftEntryView[]; totalPence: number } {
  const views = entries.map((e) => ({
    entryId: e.id,
    batchId: e.batchId,
    staffId: e.staffId,
    name: e.staff.name,
    phone: e.staff.phone ?? null,
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

/** Same data grouped into batches, in batch order. */
export function shiftBatchViews(
  shift: { baseRatePence: number; supervisorRatePence: number },
  batches: BatchRecord[],
  entries: EntryRecord[],
): { batches: BatchView[]; totalPence: number } {
  const { entries: views, totalPence } = shiftEntryViews(shift, entries);
  const byBatch = new Map<string, ShiftEntryView[]>();
  for (const v of views) {
    const list = byBatch.get(v.batchId) ?? [];
    list.push(v);
    byBatch.set(v.batchId, list);
  }
  const ordered = [...batches].sort((a, b) => a.position - b.position);
  return {
    batches: ordered.map((b) => {
      const list = byBatch.get(b.id) ?? [];
      return {
        batchId: b.id,
        label: batchLabel(b.name, b.position),
        name: b.name,
        position: b.position,
        startAt: b.startAt,
        endAt: b.endAt,
        entries: list,
        totalPence: list.reduce((sum, v) => sum + v.pay.totalPence, 0),
      };
    }),
    totalPence,
  };
}
