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
import { Card, StatusChip } from "@/components/ui";
import { Icon } from "@/components/icon";
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
  const fullyPaid = entries.length > 0 && entries.every((e) => e.paid);
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
    <div className="flex flex-col gap-4 pt-4">
      {/* Meta sits on its own full-width line: sharing the row with the
          chip and Edit button squeezes it onto two lines. */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 truncate text-[20px] font-semibold text-on-surface">
            {shift.location.name}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <StatusChip tone={fullyPaid ? "paid" : "unpaid"}>
              {fullyPaid ? "Paid" : "Unpaid"}
            </StatusChip>
            <Link
              href={`/shifts/${shift.id}/edit`}
              className="microlabel rounded-[4px] border border-outline-variant bg-surface-container-lowest px-4 py-2 text-[12px] text-on-surface hover:bg-surface-container-low"
            >
              Edit
            </Link>
          </div>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-on-surface-variant">
          <Icon name="calendar_today" size={16} />
          {formatDate(shift.startAt)} · {formatTime(shift.startAt)}–
          {formatTime(shift.endAt)}
        </p>
      </div>

      {shift.description && (
        <p className="text-[13px] text-on-surface-variant">
          {shift.description}
        </p>
      )}

      <Card>
        <div className="microlabel flex items-center justify-between text-[10px] text-on-surface-variant">
          <span>{entries.length} staff</span>
          <span>
            Base {formatPence(shift.baseRatePence)}/hr · Sup{" "}
            {formatPence(shift.supervisorRatePence)}/hr
          </span>
        </div>
        <ul className="mt-2 divide-y divide-outline-variant/50">
          {entries.map((e) => (
            <li
              key={e.entryId}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="flex items-center gap-1 text-[14px] font-semibold text-on-surface">
                  {e.name}
                  {e.isSupervisor && (
                    <Icon name="verified" size={16} className="text-secondary" />
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-variant">
                  {formatTime(e.startAt)}–{formatTime(e.endAt)} ·{" "}
                  {e.breakMinutes}m break ·{" "}
                  {formatMinutesAsHours(e.pay.workedMinutes)} @{" "}
                  {formatPence(e.pay.ratePence)}
                  {e.pay.additionalPence > 0 &&
                    ` · +${formatPence(e.pay.additionalPence)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="money text-[14px] font-semibold text-on-surface">
                  {formatPence(e.pay.totalPence)}
                </p>
                <PaidBadge entryId={e.entryId} paid={e.paid} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex items-center justify-between border-t border-outline-variant pt-3">
          <span className="microlabel text-on-surface-variant">
            Shift total
          </span>
          <span className="money text-[20px] font-bold text-on-surface">
            {formatPence(totalPence)}
          </span>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 text-[16px] font-semibold text-on-surface">
          Change history
        </h2>
        {audit.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">
            No changes recorded.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {audit.map((a) => (
              <li
                key={a.id}
                className="rounded-[4px] border border-outline-variant bg-surface-container-lowest p-3 text-[12px] shadow-sm"
              >
                <p className="mb-1 font-semibold text-on-surface">
                  {a.action === "create"
                    ? "Created"
                    : a.action === "delete"
                      ? "Deleted"
                      : "Edited"}{" "}
                  <span className="font-normal text-on-surface-variant">
                    {formatDate(a.createdAt)}, {formatTime(a.createdAt)}
                  </span>
                </p>
                {a.action === "update" && (
                  <ul className="list-inside list-disc text-on-surface-variant">
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
        <p className="text-[12px] text-on-surface-variant">
          This shift has paid entries, so it cannot be deleted.
        </p>
      )}
    </div>
  );
}
