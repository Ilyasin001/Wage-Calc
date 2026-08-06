import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config — imported by middleware, so it must not touch
 * Prisma/bcrypt. The Credentials provider (which does) lives in auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // 30 days — the accountant stays signed in on their own phone.
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    authorized({ auth }) {
      // Middleware gate: any signed-in session may access everything;
      // everyone else is redirected to /login (spec §7 — single user, no roles).
      return !!auth?.user;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
