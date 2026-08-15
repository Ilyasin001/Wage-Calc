"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStaffActive } from "@/lib/actions/staff";
import { EmptyState, InitialsTile, StatusChip } from "@/components/ui";
import { Icon } from "@/components/icon";

export interface StaffRow {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  isActive: boolean;
}

const roleLabel: Record<string, string> = {
  regular: "Regular",
  supervisor: "Supervisor",
  manager: "Manager",
};

const roleTone: Record<string, "neutral" | "blue" | "green"> = {
  regular: "neutral",
  supervisor: "blue",
  manager: "green",
};

export function StaffList({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const activeCount = staff.filter((s) => s.isActive).length;
  const inactiveCount = staff.length - activeCount;

  const visible = staff.filter(
    (s) =>
      s.isActive === (tab === "active") &&
      s.name.toLowerCase().includes(query.toLowerCase().trim()),
  );

  function toggleActive(id: string, next: boolean) {
    startTransition(async () => {
      await setStaffActive(id, next);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <Icon name="search" size={20} className="text-outline-variant" />
        </span>
        <input
          type="search"
          placeholder="Search staff members..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search staff by name"
          className="h-11 w-full rounded-[4px] border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-[14px] shadow-sm outline-none placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary"
        />
      </div>

      <div role="tablist" className="mb-4 mt-4 flex border-b border-outline-variant">
        {(
          [
            ["active", `Active (${activeCount})`],
            ["inactive", `Inactive (${inactiveCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`microlabel flex-1 border-b-2 py-3 text-center text-[12px] ${
              tab === key
                ? "border-primary font-bold text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {visible.map((s) => (
          <article
            key={s.id}
            className="flex items-center justify-between rounded-[4px] border border-outline-variant bg-surface-container-lowest p-3 shadow-sm transition-colors active:bg-surface-container"
          >
            {/* min-w-0 + truncate keep long names on one line at 375px
                instead of wrapping the whole row. */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <InitialsTile name={s.name} tone={roleTone[s.role] ?? "neutral"} />
              <div className="min-w-0">
                <h3 className="truncate text-[14px] font-semibold leading-tight text-on-surface">
                  {s.name}
                </h3>
                {/* Role chip sits on the meta line so the name keeps the
                    full row width at 375px. */}
                <div className="mt-1 flex items-center gap-2">
                  <StatusChip
                    tone={
                      s.role === "manager"
                        ? "paid"
                        : s.role === "supervisor"
                          ? "unpaid"
                          : "neutral"
                    }
                  >
                    {roleLabel[s.role] ?? s.role}
                  </StatusChip>
                  <span className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[12px] text-on-surface-variant">
                    <Icon name="phone" size={14} />
                    <span className="truncate">{s.phone || "No phone"}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex gap-1">
                <Link
                  href={`/staff/${s.id}`}
                  aria-label={`Edit ${s.name}`}
                  className="flex size-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  <Icon name="edit" size={18} />
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  aria-label={s.isActive ? `Deactivate ${s.name}` : `Reactivate ${s.name}`}
                  onClick={() => toggleActive(s.id, !s.isActive)}
                  className={`flex size-8 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                    s.isActive
                      ? "text-error hover:bg-error-container"
                      : "text-success hover:bg-tertiary-fixed/20"
                  }`}
                >
                  <Icon name={s.isActive ? "block" : "restart_alt"} size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <EmptyState>
          {query
            ? "No staff match your search."
            : tab === "active"
              ? "No active staff yet. Tap + to add your first staff member."
              : "No deactivated staff."}
        </EmptyState>
      )}
    </div>
  );
}
