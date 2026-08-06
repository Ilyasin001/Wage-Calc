import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";

export const metadata = { title: "Sign in" };

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately generic — no hint whether email or password was wrong.
      redirect("/login?error=1");
    }
    throw error; // NEXT_REDIRECT and real failures propagate
  }
}

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-[80vh] flex-col justify-center">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-700 font-serif text-3xl font-bold text-white">
          £
        </div>
        <h1 className="text-2xl font-semibold">Wage-Calc</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in to continue
        </p>
      </div>

      <form action={login} className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            Sign-in failed. Check your details and try again.
          </p>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-700 py-3 font-medium text-white hover:bg-emerald-800 active:bg-emerald-900"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
