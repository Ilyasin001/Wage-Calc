"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit, requireUser } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/staff";

const nameSchema = z.string().trim().min(1, "Name is required").max(100);

export async function createLocation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.location.findUnique({
    where: { name: parsed.data },
  });
  if (existing) return { error: "A location with that name already exists" };

  const created = await prisma.location.create({ data: { name: parsed.data } });
  await logAudit("location", created.id, "create", { name: created.name });
  revalidatePath("/settings");
  return undefined;
}

export async function renameLocation(
  locationId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const before = await prisma.location.findUnique({
    where: { id: locationId },
  });
  if (!before) return { error: "Location not found" };
  if (before.name === parsed.data) return undefined;

  const clash = await prisma.location.findUnique({
    where: { name: parsed.data },
  });
  if (clash) return { error: "A location with that name already exists" };

  await prisma.location.update({
    where: { id: locationId },
    data: { name: parsed.data },
  });
  await logAudit("location", locationId, "update", {
    name: { from: before.name, to: parsed.data },
  });
  revalidatePath("/settings");
  return undefined;
}
