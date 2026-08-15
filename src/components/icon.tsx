/** Material Symbols glyph (FILL 1), per the Stitch Performance Style design. */
export function Icon({
  name,
  size = 24,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`msym ${className}`}
      style={{ fontSize: `${size}px` }}
    >
      {name}
    </span>
  );
}
