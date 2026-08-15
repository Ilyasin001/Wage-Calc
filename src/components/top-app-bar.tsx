"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

/**
 * Fixed 44px top app bar (Performance Style). Task-flow routes (shift
 * create/edit) get a contextual back-arrow header; everywhere else shows
 * the brand title with the avatar button linking to Settings.
 */
export function TopAppBar() {
  const pathname = usePathname();
  const router = useRouter();

  const taskFlow =
    pathname === "/shifts/new" || /^\/shifts\/[^/]+\/edit$/.test(pathname);
  const title = taskFlow
    ? pathname === "/shifts/new"
      ? "New Shift"
      : "Edit Shift"
    : "Wage-Calc";

  return (
    <header className="fixed top-0 z-50 flex h-11 w-full items-center justify-between border-b border-outline-variant bg-surface px-5">
      {taskFlow ? (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => router.back()}
          className="-ml-2 flex h-11 w-11 items-center justify-start text-on-surface-variant transition-transform duration-150 active:scale-95"
        >
          <Icon name="arrow_back" />
        </button>
      ) : (
        <div className="flex h-11 w-11 items-center justify-start text-on-surface-variant">
          <Icon name="menu" />
        </div>
      )}
      <h1 className="mx-4 truncate text-[18px] font-bold tracking-[-0.01em] text-primary">
        {title}
      </h1>
      {taskFlow ? (
        <div className="h-11 w-11" />
      ) : (
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-end transition-transform duration-150 active:scale-95"
        >
          <div className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-high text-on-surface-variant">
            <Icon name="person" size={20} />
          </div>
        </Link>
      )}
    </header>
  );
}
