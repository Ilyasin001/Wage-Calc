import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteShift } from "@/lib/actions/shifts";
import { shiftEntryViews } from "@/lib/shift-view";
import {
  formatDate,
  formatMinutesAsHours,
  formatPence,
  formatTime,
} from "@/lib/format";
import { Card } from "@/components/ui";
import { describeAuditChanges } from "@/lib/audit-describe";
import { DeleteShiftButton } from "./delete-button";
import { PaidBadge } from "./paid-badge";

export const metadata = { title: "Shift" };

export default async function ShiftDetailPage({
  params,
}: PageProps<"/shifts/[id]">) {
  const { id } = await params;
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      location: true,
      entries: { include: { staff: true } },
    },
  });
  if (!shift) notFound();

  const { entries, totalPence } = shiftEntryViews(shift, shift.entries);
  const anyPaid = entries.some((e) => e.paid);
  const [audit, allStaff, allLocations] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "shift", entityId: shift.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
    prisma.location.findMany({ select: { id: true, name: true } }),
  ]);
  const staffNames = new Map(allStaff.map((s) => [s.id, s.name]));
  const locationNames = new Map(allLocations.map((l) => [l.id, l.name]));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{shift.location.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDate(shift.startAt)} · {formatTime(shift.startAt)}–
            {formatTime(shift.endAt)}
          </p>
        </div>
        <Link
          href={`/shifts/${shift.id}/edit`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Edit
        </Link>
      </div>

      {shift.description && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {shift.description}
        </p>
      )}

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            {entries.length} staff · base {formatPence(shift.baseRatePence)}/hr
            · supervisor {formatPence(shift.supervisorRatePence)}/hr
          </span>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((e) => (
            <li key={e.entryId} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">
                  {e.name}
                  {e.isSupervisor && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      Supervisor
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatTime(e.startAt)}–{formatTime(e.endAt)} ·{" "}
                  {e.breakMinutes}m break ·{" "}
                  {formatMinutesAsHours(e.pay.workedMinutes)} @{" "}
                  {formatPence(e.pay.ratePence)}
                  {e.pay.additionalPence > 0 &&
                    ` · +${formatPence(e.pay.additionalPence)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatPence(e.pay.totalPence)}</p>
                <PaidBadge entryId={e.entryId} paid={e.paid} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          <span className="font-medium">Shift total</span>
          <span className="text-lg font-bold">{formatPence(totalPence)}</span>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 font-medium">Change history</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-slate-500">No changes recorded.</p>
        ) : (
          <ul className="space-y-2">
            {audit.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
              >
                <p className="mb-1 font-medium">
                  {a.action === "create"
                    ? "Created"
                    : a.action === "delete"
                      ? "Deleted"
                      : "Edited"}{" "}
                  <span className="font-normal text-slate-500">
                    {formatDate(a.createdAt)}, {formatTime(a.createdAt)}
                  </span>
                </p>
                {a.action === "update" && (
                  <ul className="list-inside list-disc text-slate-500 dark:text-slate-400">
                    {describeAuditChanges(
                      a.changes,
                      staffNames,
                      locationNames,
                    ).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeleteShiftButton
        shiftId={shift.id}
        disabled={anyPaid}
        deleteAction={deleteShift}
      />
      {anyPaid && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This shift has paid entries, so it cannot be deleted.
        </p>
      )}
    </div>
  );
}
