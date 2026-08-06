import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * Audit plumbing (D17): every mutation is recorded — nothing is silent.
 * `changes` is a JSON object: for updates a field→{from,to} diff of what
 * actually changed; for create/delete a snapshot of the entity.
 */

export type AuditEntityType =
  | "staff"
  | "location"
  | "settings"
  | "shift"
  | "shiftEntry";

export type AuditAction = "create" | "update" | "delete";

type Tx = Pick<typeof prisma, "auditLog">;

export async function logAudit(
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  changes: Record<string, unknown>,
  tx: Tx = prisma,
): Promise<void> {
  await tx.auditLog.create({
    data: { entityType, entityId, action, changes: JSON.stringify(changes) },
  });
}

/** field→{from,to} for fields that differ; empty object = nothing changed. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    const fromCmp = from instanceof Date ? from.getTime() : from;
    const toCmp = to instanceof Date ? to.getTime() : to;
    if (fromCmp !== toCmp) diff[key] = { from, to };
  }
  return diff;
}

/**
 * Defense in depth for server actions: the route proxy already blocks
 * unauthenticated page requests, but every mutating action re-checks the
 * session itself (spec §7).
 */
export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) throw new Error("Not authenticated");
  return { id: (user as { id?: string }).id ?? "", email: user.email };
}
