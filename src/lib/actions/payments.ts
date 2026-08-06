"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit, requireUser } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/staff";

const idsSchema = z.array(z.string().min(1)).min(1).max(2000);

/**
 * Marks the given entries paid (D14). Idempotent: entries already paid are
 * skipped, so a double-tap can never double-record. Returns how many changed.
 */
export async function markEntriesPaid(
  entryIds: string[],
): Promise<ActionResult & { marked?: number }> {
  await requireUser();
  const parsed = idsSchema.safeParse(entryIds);
  if (!parsed.success) return { error: "Invalid selection" };

  const now = new Date();
  const marked = await prisma.$transaction(async (tx) => {
    const entries = await tx.shiftEntry.findMany({
      where: { id: { in: parsed.data }, paid: false },
    });
    if (entries.length === 0) return 0;
    await tx.shiftEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { paid: true, paidAt: now },
    });
    for (const e of entries) {
      await logAudit(
        "shiftEntry",
        e.id,
        "update",
        {
          staffId: e.staffId,
          shiftId: e.shiftId,
          paid: { from: false, to: true },
        },
        tx,
      );
    }
    return entries.length;
  });

  revalidatePath("/payments");
  revalidatePath("/");
  return { marked };
}

/**
 * Reverts a paid entry to unpaid (A4) — the deliberate unlock step before a
 * paid entry can be edited. Audit-logged.
 */
export async function revertEntryUnpaid(entryId: string): Promise<ActionResult> {
  await requireUser();
  const entry = await prisma.shiftEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "Entry not found" };
  if (!entry.paid) return undefined;

  await prisma.$transaction(async (tx) => {
    await tx.shiftEntry.update({
      where: { id: entryId },
      data: { paid: false, paidAt: null },
    });
    await logAudit(
      "shiftEntry",
      entryId,
      "update",
      {
        staffId: entry.staffId,
        shiftId: entry.shiftId,
        paid: { from: true, to: false },
      },
      tx,
    );
  });

  revalidatePath("/payments");
  revalidatePath(`/shifts/${entry.shiftId}`);
  return undefined;
}
