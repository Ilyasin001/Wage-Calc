import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Uses only the edge-safe config: the `authorized` callback redirects
// unauthenticated requests to /login. Every route is guarded except the
// login page itself, the auth API, and static assets (spec §7).
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|icon.svg|manifest.webmanifest|favicon.ico).*)",
  ],
};
