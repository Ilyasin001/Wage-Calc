import { signOut } from "@/auth";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Rates, locations and account settings arrive in Milestone 4.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
        className="mt-6"
      >
        <button
          type="submit"
          className="w-full rounded-lg border border-slate-300 py-3 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
