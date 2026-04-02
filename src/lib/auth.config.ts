import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

/**
 * Auth config without DB adapter — safe for Edge Runtime (middleware).
 * The full auth.ts adds the Drizzle adapter and bcrypt verification.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    // Credentials provider declared here so NextAuth recognises it,
    // but actual authorize() logic lives in auth.ts (Node runtime only).
    Credentials({ credentials: {} }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuthenticated = !!auth?.user;
      const isAppRoute =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/boards");
      const isAuthRoute =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

      if (isAppRoute && !isAuthenticated) return false;
      if (isAuthRoute && isAuthenticated) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
};
