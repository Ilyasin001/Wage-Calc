import paths from "@/components/icon-paths";

/**
 * Material Symbols glyph (Outlined, FILL 1) rendered as inline SVG, per the
 * Stitch Performance Style design. Inline rather than an icon font — see
 * icon-paths.ts for why.
 */
export function Icon({
  name,
  size = 24,
  className = "",
}: {
  name: keyof typeof paths | string;
  size?: number;
  className?: string;
}) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      fill="currentColor"
      className={`inline-block shrink-0 align-middle ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
