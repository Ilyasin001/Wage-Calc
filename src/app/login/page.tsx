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

const loginInput =
  "w-full h-11 px-3 bg-surface rounded-[4px] border border-outline-variant text-[15px] text-on-surface outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-[85vh] flex-col justify-center">
      <div className="mb-8 text-center">
        <div className="money mx-auto mb-3 flex size-14 items-center justify-center rounded-[8px] bg-primary text-[28px] font-bold text-on-primary">
          £
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-primary">
          Wage-Calc
        </h1>
        <p className="mt-1 text-[13px] text-on-surface-variant">
          Sign in to continue
        </p>
      </div>

      <form
        action={login}
        className="flex flex-col gap-4 rounded-[8px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm"
      >
        {error && (
          <p
            role="alert"
            className="rounded-[4px] bg-error-container px-4 py-3 text-[13px] text-on-error-container"
          >
            Sign-in failed. Check your details and try again.
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="microlabel text-on-surface-variant">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            className={loginInput}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="microlabel text-on-surface-variant">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className={loginInput}
          />
        </label>
        <button
          type="submit"
          className="h-11 w-full rounded-[4px] bg-secondary text-[14px] font-semibold text-on-secondary shadow-sm transition-colors hover:bg-on-secondary-fixed-variant active:scale-95"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
