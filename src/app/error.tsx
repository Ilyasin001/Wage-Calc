"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-[13px] text-on-surface-variant">
        Nothing has been lost — your saved shifts are safe.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-[4px] bg-secondary px-6 py-3 text-[14px] font-semibold text-on-secondary hover:bg-on-secondary-fixed-variant"
      >
        Try again
      </button>
    </div>
  );
}
