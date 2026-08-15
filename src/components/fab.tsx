import Link from "next/link";
import { Icon } from "@/components/icon";

/**
 * Floating action button above the bottom nav (Performance Style).
 *
 * Renders a spacer alongside the fixed button: being fixed, the button is
 * out of flow and would otherwise cover the last row of a list.
 */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <>
      <div aria-hidden className="h-20" />
      <Link
        href={href}
        aria-label={label}
        className="fixed bottom-[88px] right-5 z-40 flex size-14 items-center justify-center rounded-full bg-secondary text-on-secondary shadow-lg transition-all duration-200 hover:bg-on-secondary-fixed-variant active:scale-95"
      >
        <Icon name="add" />
      </Link>
    </>
  );
}
