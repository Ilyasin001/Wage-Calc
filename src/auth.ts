import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { checkLoginRateLimit, recordFailedLogin } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();

        if (!checkLoginRateLimit(email)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Compare against a dummy hash when the user is unknown so response
        // timing doesn't reveal which emails exist.
        const hash =
          user?.passwordHash ??
          "$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZUW1GBBEcNkII1DKpVenkHLu2p2u2m";
        const valid = await compare(parsed.data.password, hash);
        if (!user || !valid) {
          recordFailedLogin(email);
          return null;
        }
        return { id: user.id, email: user.email };
      },
    }),
  ],
});
