"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";

const tabs = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/payments", label: "Payments", icon: "payments" },
  { href: "/staff", label: "Staff", icon: "group" },
  { href: "/reports", label: "Reports", icon: "analytics" },
] as const;

/** 5-tab bottom nav (Performance Style); hidden on task-flow routes. */
export function BottomNav() {
  const pathname = usePathname();
  const taskFlow =
    pathname === "/shifts/new" || /^\/shifts\/[^/]+\/edit$/.test(pathname);
  if (taskFlow) return null;

  return (
    <nav className="pb-safe fixed bottom-0 z-50 flex h-16 w-full items-center justify-around border-t border-outline-variant bg-surface px-5">
      {tabs.map(({ href, label, icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-full flex-1 flex-col items-center justify-center transition-opacity active:opacity-80 ${
              active
                ? "font-bold text-secondary"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <Icon name={icon} className="mb-1" />
            <span className="microlabel text-[10px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
