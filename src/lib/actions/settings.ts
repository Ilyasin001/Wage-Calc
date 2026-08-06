"use server";

import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit, requireUser } from "@/lib/audit";
import { parsePoundsToPence } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/staff";

/**
 * Updates the company-wide standard rates (D4). Affects future shifts only —
 * existing shifts keep their snapshot rates.
 */
export async function updateRates(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const basePence = parsePoundsToPence(String(formData.get("baseRate") ?? ""));
  const supPence = parsePoundsToPence(
    String(formData.get("supervisorRate") ?? ""),
  );
  if (basePence === null || basePence <= 0) {
    return { error: "Base rate must be a positive amount like 12.50" };
  }
  if (supPence === null || supPence <= 0) {
    return { error: "Supervisor rate must be a positive amount like 15.00" };
  }

  const before = await prisma.settings.findUnique({ where: { id: 1 } });
  const after = { baseRatePence: basePence, supervisorRatePence: supPence };
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...after },
    update: after,
  });
  await logAudit(
    "settings",
    "1",
    before ? "update" : "create",
    before
      ? {
          baseRatePence: { from: before.baseRatePence, to: basePence },
          supervisorRatePence: {
            from: before.supervisorRatePence,
            to: supPence,
          },
        }
      : after,
  );
  revalidatePath("/settings");
  return undefined;
}

const passwordSchema = z
  .string()
  .min(10, "New password must be at least 10 characters");

export async function changePassword(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = passwordSchema.safeParse(formData.get("newPassword"));
  if (!next.success) return { error: next.error.issues[0].message };
  if (next.data !== String(formData.get("confirmPassword") ?? "")) {
    return { error: "New passwords do not match" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
  });
  if (!dbUser || !(await compare(current, dbUser.passwordHash))) {
    return { error: "Current password is incorrect" };
  }

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { passwordHash: await hash(next.data, 12) },
  });
  return undefined;
}
