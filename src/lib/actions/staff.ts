"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { diffFields, logAudit, requireUser } from "@/lib/audit";

export type ActionResult = { error?: string } | undefined;

const staffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\-\s]*$/, "Phone may only contain digits, spaces, + ( ) -")
    .optional()
    .or(z.literal("")),
  role: z.enum(["regular", "supervisor", "manager"]),
});

export async function createStaff(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const created = await prisma.staff.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
    },
  });
  await logAudit("staff", created.id, "create", {
    name: created.name,
    phone: created.phone,
    role: created.role,
  });
  revalidatePath("/staff");
  redirect("/staff");
}

export async function updateStaff(
  staffId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const before = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!before) return { error: "Staff member not found" };

  const after = {
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    role: parsed.data.role,
  };
  const diff = diffFields(before as unknown as Record<string, unknown>, after);
  if (Object.keys(diff).length > 0) {
    await prisma.staff.update({ where: { id: staffId }, data: after });
    await logAudit("staff", staffId, "update", diff);
  }
  revalidatePath("/staff");
  redirect("/staff");
}

export async function setStaffActive(
  staffId: string,
  isActive: boolean,
): Promise<void> {
  await requireUser();
  const before = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!before || before.isActive === isActive) return;
  await prisma.staff.update({ where: { id: staffId }, data: { isActive } });
  await logAudit("staff", staffId, "update", {
    isActive: { from: before.isActive, to: isActive },
  });
  revalidatePath("/staff");
}
