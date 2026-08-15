import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

/* Shared primitives styled per the Stitch "Performance Style" screens. */

export const inputClass =
  "w-full h-[40px] px-3 bg-surface rounded-[4px] border border-outline-variant text-on-surface text-[14px] outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="microlabel text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} appearance-none`} />;
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-[4px] bg-secondary text-[14px] font-semibold text-on-secondary shadow-sm transition-colors duration-150 hover:bg-on-secondary-fixed-variant active:scale-95 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-[4px] border border-outline-variant bg-surface-container-lowest text-[14px] font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[4px] bg-error-container px-4 py-3 text-[13px] text-on-error-container"
    >
      {children}
    </p>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-[4px] bg-tertiary-fixed/25 px-4 py-3 text-[13px] font-medium text-success"
    >
      {children}
    </p>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[8px] border border-dashed border-outline-variant p-6 text-center text-[13px] text-on-surface-variant">
      {children}
    </p>
  );
}

/** Uppercase status chip: "paid" green, "unpaid" blue, "neutral" grey. */
export function StatusChip({
  tone,
  children,
}: {
  tone: "paid" | "unpaid" | "neutral";
  children: ReactNode;
}) {
  const tones = {
    paid: "text-success bg-success/10",
    unpaid: "text-secondary bg-secondary/10",
    neutral: "text-on-surface-variant bg-surface-container-high",
  } as const;
  return (
    <span
      className={`microlabel inline-block whitespace-nowrap rounded-[4px] px-2.5 py-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Initials tile used across staff rows (10×10, 4px radius). */
export function InitialsTile({
  name,
  tone = "neutral",
}: {
  name: string;
  tone?: "neutral" | "blue" | "green";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const tones = {
    neutral: "bg-surface-container-high text-on-surface-variant",
    blue: "bg-secondary-fixed/60 text-on-secondary-fixed-variant",
    green: "bg-tertiary-fixed/30 text-success",
  } as const;
  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center rounded-[4px] text-[14px] font-bold ${tones[tone]}`}
    >
      {initials}
    </div>
  );
}
