"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { diffFields, logAudit, requireUser } from "@/lib/audit";
import { formatDate, formatTime } from "@/lib/format";
import { shiftPayloadSchema, type ShiftPayload } from "@/lib/shift-schema";
import { londonToUtc, resolveEntryEnd, resolveEntryStart } from "@/lib/time";
import { validateBatch, validateEntry, validateRates } from "@/lib/wage";
import type { ActionResult } from "@/lib/actions/staff";

const DAY_MS = 24 * 60 * 60 * 1000;

const issueMessages: Record<string, string> = {
  "start-not-on-15-minute-boundary": "times must be in 15-minute steps",
  "end-not-on-15-minute-boundary": "times must be in 15-minute steps",
  "end-not-after-start": "finish time must be after start time",
  "negative-break": "break cannot be negative",
  "break-not-on-5-minute-step": "break must be in 5-minute steps",
  "break-consumes-entire-time": "break is as long as the whole time worked",
  "negative-additional": "additional amount cannot be negative",
  "outside-shift-window": "times fall outside the shift's own start and finish",
};

interface ResolvedEntry {
  staffId: string;
  isSupervisor: boolean;
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  additionalPence: number;
}

interface ResolvedBatch {
  name: string | null;
  position: number;
  startAt: Date;
  endAt: Date;
  entries: ResolvedEntry[];
}

interface Resolved {
  payload: ShiftPayload;
  locationId: string;
  startAt: Date;
  endAt: Date;
  batches: ResolvedBatch[];
  /** Flattened for clash checks and paid-entry comparison. */
  entries: ResolvedEntry[];
}

function batchLabel(name: string | null, position: number): string {
  return name?.trim() ? name.trim() : `Batch ${position}`;
}

/**
 * Shared validation + time resolution for create and update.
 * Returns either a fully resolved shift or a user-facing error message.
 */
async function resolveShift(
  raw: unknown,
  excludeShiftId: string | null,
): Promise<{ ok: Resolved } | { error: string }> {
  const parsed = shiftPayloadSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;

  const rateIssues = validateRates({
    baseRatePence: p.baseRatePence,
    supervisorRatePence: p.supervisorRatePence,
  });
  if (rateIssues.length > 0) return { error: "Rates must be positive amounts" };

  // Shift window
  const startAt = londonToUtc(p.date, p.startTime);
  const endAt = resolveEntryEnd(startAt, p.endTime);
  if (endAt.getTime() - startAt.getTime() > DAY_MS) {
    return { error: "A shift cannot be longer than 24 hours" };
  }
  const shiftWindow = { startAt, endAt };

  // Supervisor invariants (D5): exactly one across the whole shift.
  const allEntries = p.batches.flatMap((b) => b.entries);
  const supervisors = allEntries.filter((e) => e.isSupervisor);
  if (supervisors.length !== 1) {
    return { error: "Exactly one staff member must be the supervisor" };
  }

  // Unique staff across the shift (DB also enforces).
  const ids = allEntries.map((e) => e.staffId);
  if (new Set(ids).size !== ids.length) {
    return {
      error: "A staff member appears more than once — check the batches",
    };
  }

  const staff = await prisma.staff.findMany({ where: { id: { in: ids } } });
  const staffById = new Map(staff.map((s) => [s.id, s]));
  if (staff.length !== ids.length) {
    return { error: "A selected staff member no longer exists" };
  }

  // Resolve each batch, then each entry relative to its own batch's times.
  const batches: ResolvedBatch[] = [];
  for (const [index, b] of p.batches.entries()) {
    const position = index + 1;
    const label = batchLabel(b.name ?? null, position);
    const batchStart = resolveEntryStart(p.date, startAt, b.startTime);
    const batchEnd = resolveEntryEnd(batchStart, b.endTime);
    const batchIssues = validateBatch(
      { startAt: batchStart, endAt: batchEnd },
      shiftWindow,
    );
    if (batchIssues.length > 0) {
      return {
        error: `${label}: ${issueMessages[batchIssues[0]] ?? batchIssues[0]}`,
      };
    }

    const entries: ResolvedEntry[] = [];
    for (const e of b.entries) {
      const name = staffById.get(e.staffId)!.name;
      const entryStart = resolveEntryStart(p.date, batchStart, e.startTime);
      const entryEnd = resolveEntryEnd(entryStart, e.endTime);
      const issues = validateEntry(
        {
          startAt: entryStart,
          endAt: entryEnd,
          breakMinutes: e.breakMinutes,
          isSupervisor: e.isSupervisor,
          additionalPence: e.additionalPence,
        },
        shiftWindow,
      );
      if (issues.length > 0) {
        return {
          error: `${name} (${label}): ${issueMessages[issues[0]] ?? issues[0]}`,
        };
      }
      entries.push({
        staffId: e.staffId,
        isSupervisor: e.isSupervisor,
        startAt: entryStart,
        endAt: entryEnd,
        breakMinutes: e.breakMinutes,
        additionalPence: e.additionalPence,
      });
    }

    batches.push({
      name: b.name?.trim() ? b.name.trim() : null,
      position,
      startAt: batchStart,
      endAt: batchEnd,
      entries,
    });
  }

  const flatEntries = batches.flatMap((b) => b.entries);

  // Clash detection (D10): no staff member in two overlapping shifts.
  for (const e of flatEntries) {
    const clash = await prisma.shiftEntry.findFirst({
      where: {
        staffId: e.staffId,
        ...(excludeShiftId ? { shiftId: { not: excludeShiftId } } : {}),
        startAt: { lt: e.endAt },
        endAt: { gt: e.startAt },
      },
      include: { shift: { include: { location: true } } },
    });
    if (clash) {
      const name = staffById.get(e.staffId)!.name;
      return {
        error: `${name} is already on the shift at ${clash.shift.location.name} on ${formatDate(clash.shift.startAt)} (${formatTime(clash.startAt)}–${formatTime(clash.endAt)})`,
      };
    }
  }

  // Location: existing id or inline-created (D15)
  let locationId = p.locationId ?? "";
  if (!locationId && p.newLocationName) {
    const existing = await prisma.location.findUnique({
      where: { name: p.newLocationName },
    });
    if (existing) {
      locationId = existing.id;
    } else {
      const created = await prisma.location.create({
        data: { name: p.newLocationName },
      });
      await logAudit("location", created.id, "create", { name: created.name });
      locationId = created.id;
    }
  } else if (locationId) {
    const exists = await prisma.location.findUnique({
      where: { id: locationId },
    });
    if (!exists) return { error: "Venue not found" };
  }

  return {
    ok: { payload: p, locationId, startAt, endAt, batches, entries: flatEntries },
  };
}

function entrySnapshot(e: ResolvedEntry) {
  return {
    staffId: e.staffId,
    isSupervisor: e.isSupervisor,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    breakMinutes: e.breakMinutes,
    additionalPence: e.additionalPence,
  };
}

function batchSnapshot(b: ResolvedBatch) {
  return {
    name: b.name,
    position: b.position,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    entries: b.entries.map(entrySnapshot),
  };
}

export async function createShift(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Invalid form submission" };
  }
  const result = await resolveShift(raw, null);
  if ("error" in result) return { error: result.error };
  const { payload, locationId, startAt, endAt, batches } = result.ok;

  const shift = await prisma.$transaction(async (tx) => {
    const created = await tx.shift.create({
      data: {
        date: payload.date,
        locationId,
        description: payload.description || null,
        startAt,
        endAt,
        baseRatePence: payload.baseRatePence,
        supervisorRatePence: payload.supervisorRatePence,
      },
    });
    for (const b of batches) {
      await tx.batch.create({
        data: {
          shiftId: created.id,
          name: b.name,
          position: b.position,
          startAt: b.startAt,
          endAt: b.endAt,
          entries: {
            create: b.entries.map((e) => ({
              shiftId: created.id,
              staffId: e.staffId,
              isSupervisor: e.isSupervisor ? true : null,
              startAt: e.startAt,
              endAt: e.endAt,
              breakMinutes: e.breakMinutes,
              additionalPence: e.additionalPence,
            })),
          },
        },
      });
    }
    await logAudit(
      "shift",
      created.id,
      "create",
      {
        date: payload.date,
        locationId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        baseRatePence: payload.baseRatePence,
        supervisorRatePence: payload.supervisorRatePence,
        batches: batches.map(batchSnapshot),
      },
      tx,
    );
    return created;
  });

  revalidatePath("/");
  redirect(`/shifts/${shift.id}`);
}

const PAID_LOCK_MESSAGE =
  "This change would affect an entry already marked as paid. Revert it to unpaid first (Payments screen).";

export async function updateShift(
  shiftId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Invalid form submission" };
  }

  const existing = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { entries: true, batches: true },
  });
  if (!existing) return { error: "Shift not found" };

  const result = await resolveShift(raw, shiftId);
  if ("error" in result) return { error: result.error };
  const { payload, locationId, startAt, endAt, batches, entries } = result.ok;

  // Paid-entry locking (A4/A5): every paid entry must survive unchanged,
  // and the shift's rates must not move under it.
  const paidEntries = existing.entries.filter((e) => e.paid);
  if (paidEntries.length > 0) {
    if (
      payload.baseRatePence !== existing.baseRatePence ||
      payload.supervisorRatePence !== existing.supervisorRatePence
    ) {
      return { error: PAID_LOCK_MESSAGE };
    }
    for (const paid of paidEntries) {
      const next = entries.find((e) => e.staffId === paid.staffId);
      const unchanged =
        next &&
        next.startAt.getTime() === paid.startAt.getTime() &&
        next.endAt.getTime() === paid.endAt.getTime() &&
        next.breakMinutes === paid.breakMinutes &&
        next.additionalPence === paid.additionalPence &&
        next.isSupervisor === (paid.isSupervisor === true);
      if (!unchanged) return { error: PAID_LOCK_MESSAGE };
    }
  }

  await prisma.$transaction(async (tx) => {
    const shiftDiff = diffFields(
      {
        date: existing.date,
        locationId: existing.locationId,
        description: existing.description,
        startAt: existing.startAt,
        endAt: existing.endAt,
        baseRatePence: existing.baseRatePence,
        supervisorRatePence: existing.supervisorRatePence,
      },
      {
        date: payload.date,
        locationId,
        description: payload.description || null,
        startAt,
        endAt,
        baseRatePence: payload.baseRatePence,
        supervisorRatePence: payload.supervisorRatePence,
      },
    );

    await tx.shift.update({
      where: { id: shiftId },
      data: {
        date: payload.date,
        locationId,
        description: payload.description || null,
        startAt,
        endAt,
        baseRatePence: payload.baseRatePence,
        supervisorRatePence: payload.supervisorRatePence,
      },
    });

    // Batches are rebuilt wholesale — they hold no state beyond times and
    // membership, and paid entries were proven unchanged above. Entries keep
    // their original id when the same staff member is still on the shift, so
    // audit records of payments continue to resolve. Supervisor flags are
    // cleared first so the partial unique index never sees two supervisors
    // mid-write.
    const previousByStaff = new Map(existing.entries.map((e) => [e.staffId, e]));
    await tx.shiftEntry.updateMany({
      where: { shiftId },
      data: { isSupervisor: null },
    });
    await tx.shiftEntry.deleteMany({ where: { shiftId } });
    await tx.batch.deleteMany({ where: { shiftId } });

    for (const b of batches) {
      await tx.batch.create({
        data: {
          shiftId,
          name: b.name,
          position: b.position,
          startAt: b.startAt,
          endAt: b.endAt,
          entries: {
            create: b.entries.map((e) => {
              const before = previousByStaff.get(e.staffId);
              return {
                ...(before ? { id: before.id } : {}),
                shiftId,
                staffId: e.staffId,
                isSupervisor: e.isSupervisor ? true : null,
                startAt: e.startAt,
                endAt: e.endAt,
                breakMinutes: e.breakMinutes,
                additionalPence: e.additionalPence,
                // Paid status survives an edit — it is settled money.
                paid: before?.paid ?? false,
                paidAt: before?.paidAt ?? null,
              };
            }),
          },
        },
      });
    }

    await logAudit(
      "shift",
      shiftId,
      "update",
      { ...shiftDiff, batches: batches.map(batchSnapshot) },
      tx,
    );
  });

  revalidatePath("/");
  revalidatePath(`/shifts/${shiftId}`);
  redirect(`/shifts/${shiftId}`);
}

export async function deleteShift(shiftId: string): Promise<ActionResult> {
  await requireUser();
  const existing = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { entries: true, location: true },
  });
  if (!existing) return { error: "Shift not found" };
  if (existing.entries.some((e) => e.paid)) {
    return {
      error:
        "This shift has entries already marked as paid and cannot be deleted (A5).",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.shift.delete({ where: { id: shiftId } }); // batches + entries cascade
    await logAudit(
      "shift",
      shiftId,
      "delete",
      {
        date: existing.date,
        location: existing.location.name,
        startAt: existing.startAt.toISOString(),
        endAt: existing.endAt.toISOString(),
        baseRatePence: existing.baseRatePence,
        supervisorRatePence: existing.supervisorRatePence,
        entries: existing.entries.map((e) => ({
          staffId: e.staffId,
          isSupervisor: e.isSupervisor === true,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt.toISOString(),
          breakMinutes: e.breakMinutes,
          additionalPence: e.additionalPence,
        })),
      },
      tx,
    );
  });

  revalidatePath("/");
  redirect("/");
}
