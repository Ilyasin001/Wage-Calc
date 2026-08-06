"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState, inputClass } from "@/components/ui";

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

export function StaffList({ staff }: { staff: StaffRow[] }) {
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [query, setQuery] = useState("");

  const activeCount = staff.filter((s) => s.isActive).length;
  const inactiveCount = staff.length - activeCount;

  const visible = staff.filter(
    (s) =>
      s.isActive === (tab === "active") &&
      s.name.toLowerCase().includes(query.toLowerCase().trim()),
  );

  return (
    <div>
      <input
        type="search"
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputClass}
        aria-label="Search staff by name"
      />

      <div
        role="tablist"
        className="mt-3 grid grid-cols-2 rounded-lg border border-slate-200 p-1 text-sm font-medium dark:border-slate-800"
      >
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
            className={`rounded-md py-2 ${
              tab === key
                ? "bg-emerald-700 text-white"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="mt-3 space-y-2">
        {visible.map((s) => (
          <li key={s.id}>
            <Link
              href={`/staff/${s.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-600 dark:border-slate-800 dark:bg-slate-950"
            >
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {roleLabel[s.role] ?? s.role}
                  {s.phone ? ` · ${s.phone}` : ""}
                </p>
              </div>
              <span aria-hidden className="text-slate-400">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <div className="mt-3">
          <EmptyState>
            {query
              ? "No staff match your search."
              : tab === "active"
                ? "No active staff yet. Add your first staff member."
                : "No deactivated staff."}
          </EmptyState>
        </div>
      )}
    </div>
  );
}
