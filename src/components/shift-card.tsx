import Link from "next/link";
import { formatPence, formatTime } from "@/lib/format";
import { Icon } from "@/components/icon";

/**
 * Compact shift row used by Home and History (Performance Style).
 *
 * The meta runs on two lines: date + staff count, then the times. On a
 * 375px screen all of it on one line collides with the amount column, and
 * truncating would hide fields the spec requires (§5).
 */
export function ShiftCard({
  href,
  location,
  dateLabel,
  staffCount,
  startAt,
  endAt,
  totalPence,
  fullyPaid,
}: {
  href: string;
  location: string;
  dateLabel: string;
  staffCount: number;
  startAt: Date;
  endAt: Date;
  totalPence: number;
  fullyPaid: boolean;
}) {
  return (
    <Link href={href}>
      {/* Deliberately not an <article>: a nested article role would
          suppress the link's name-from-content and leave it unlabelled. */}
      <div className="flex items-center justify-between gap-2 rounded-[4px] border border-outline-variant bg-surface-container-lowest p-3 shadow-sm transition-colors active:bg-surface-container">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-[4px] ${
              fullyPaid
                ? "bg-tertiary-fixed/20 text-tertiary-fixed-dim"
                : "bg-secondary-fixed/40 text-secondary"
            }`}
          >
            <Icon
              name={fullyPaid ? "check_circle" : "pending_actions"}
              size={20}
            />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-semibold leading-tight text-on-surface">
              {location}
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-on-surface-variant">
              {dateLabel}
              <span className="px-1.5 text-outline-variant">•</span>
              {staffCount} Staff
            </p>
            <p className="truncate text-[12px] text-on-surface-variant">
              {formatTime(startAt)}–{formatTime(endAt)}
            </p>
          </div>
        </div>
        <div className="shrink-0 pl-2 text-right">
          <span className="money block text-[14px] font-semibold text-on-surface">
            {formatPence(totalPence)}
          </span>
          <span
            className={`microlabel text-[10px] ${
              fullyPaid ? "text-tertiary-fixed-dim" : "text-secondary"
            }`}
          >
            {fullyPaid ? "Paid" : "Unpaid"}
          </span>
        </div>
      </div>
    </Link>
  );
}
