import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        This page or record doesn&apos;t exist — it may have been deleted.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800"
      >
        Back to home
      </Link>
    </div>
  );
}
