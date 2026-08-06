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
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Nothing has been lost — your saved shifts are safe.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800"
      >
        Try again
      </button>
    </div>
  );
}
