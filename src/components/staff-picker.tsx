"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { InitialsTile } from "@/components/ui";

export interface PickableStaff {
  id: string;
  name: string;
  role: string;
}

/**
 * Multi-select roster picker. Large functions run to ~25 staff in a single
 * batch, so staff are added in one go rather than one tap at a time.
 */
export function StaffPicker({
  staff,
  alreadyOnShift,
  title,
  onCancel,
  onAdd,
}: {
  staff: PickableStaff[];
  /** Staff already placed in any batch of this shift — not selectable. */
  alreadyOnShift: Set<string>;
  title: string;
  onCancel: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const available = useMemo(
    () => staff.filter((s) => !alreadyOnShift.has(s.id)),
    [staff, alreadyOnShift],
  );
  const visible = useMemo(
    () =>
      available.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase().trim()),
      ),
    [available, query],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((s) => selected.has(s.id));

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((s) => next.delete(s.id));
      else visible.forEach((s) => next.add(s.id));
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-outline-variant px-5">
        <button
          type="button"
          onClick={onCancel}
          className="flex size-10 items-center justify-center text-on-surface-variant"
          aria-label="Cancel"
        >
          <Icon name="close" />
        </button>
        <h2 className="text-[16px] font-semibold text-on-surface">{title}</h2>
        <span className="microlabel text-secondary">
          {selected.size} picked
        </span>
      </header>

      <div className="shrink-0 space-y-2 px-5 py-3">
        <div className="relative">
          <Icon
            name="search"
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roster…"
            aria-label="Search roster"
            className="h-11 w-full rounded-full border border-outline-variant bg-surface-container-lowest pl-12 pr-4 text-[14px] outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={toggleAllVisible}
            className="microlabel text-secondary"
          >
            {allVisibleSelected
              ? `Clear all ${visible.length}`
              : `Select all ${visible.length}`}
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
        {visible.map((s) => {
          const on = selected.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className={`mb-2 flex w-full items-center gap-3 rounded-[4px] border p-2.5 text-left ${
                  on
                    ? "border-secondary bg-secondary/10"
                    : "border-outline-variant bg-surface-container-lowest"
                }`}
              >
                <InitialsTile name={s.name} tone={on ? "blue" : "neutral"} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-on-surface">
                  {s.name}
                </span>
                {on && <Icon name="check_circle" size={20} className="text-secondary" />}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="py-6 text-center text-[13px] text-on-surface-variant">
            {available.length === 0
              ? "Everyone on the roster is already on this shift."
              : "No staff match your search."}
          </li>
        )}
      </ul>

      <div className="pb-safe shrink-0 border-t border-outline-variant px-5 py-3">
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onAdd([...selected])}
          className="h-11 w-full rounded-[4px] bg-secondary text-[14px] font-semibold text-on-secondary disabled:opacity-50"
        >
          Add {selected.size || ""} to batch
        </button>
      </div>
    </div>
  );
}
