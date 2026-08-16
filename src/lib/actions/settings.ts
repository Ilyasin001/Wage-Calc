"use server";

import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit, requireUser } from "@/lib/audit";
import { parsePoundsToPence } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/staff";

/** Company/account name — printed as the header on every PDF report. */
export async function updateCompanyName(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = z
    .string()
    .trim()
    .max(120, "Company name is too long")
    .safeParse(formData.get("companyName"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const companyName = parsed.data || null;

  const before = await prisma.settings.findUnique({ where: { id: 1 } });
  await prisma.settings.upsert({
    where: { id: 1 },
    // Rates are required on create; a fresh install seeds them anyway.
    create: {
      id: 1,
      companyName,
      baseRatePence: before?.baseRatePence ?? 0,
      supervisorRatePence: before?.supervisorRatePence ?? 0,
    },
    update: { companyName },
  });
  await logAudit("settings", "1", "update", {
    companyName: { from: before?.companyName ?? null, to: companyName },
  });
  revalidatePath("/settings");
  return undefined;
}

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
  // Log the event, never the value (D17).
  await logAudit("settings", dbUser.id, "update", { password: "changed" });
  return undefined;
}
