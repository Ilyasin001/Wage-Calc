import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-[13px] text-on-surface-variant">
        This page or record doesn&apos;t exist — it may have been deleted.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-[4px] bg-secondary px-6 py-3 text-[14px] font-semibold text-on-secondary hover:bg-on-secondary-fixed-variant"
      >
        Back to home
      </Link>
    </div>
  );
}
