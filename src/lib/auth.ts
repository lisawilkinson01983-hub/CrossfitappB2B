import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { checkRateLimit, getClientIp } from "./rateLimit";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();

        // Capped per IP and per email attempted, so an attacker can't just
        // rotate IPs against one account or spray many accounts from one IP.
        const ip = getClientIp(req.headers ?? {});
        const ipLimit = checkRateLimit(ip, "login", { limit: 20, windowMs: 15 * 60 * 1000 });
        const emailLimit = checkRateLimit(email, "login-email", { limit: 8, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.ok || !emailLimit.ok) throw new Error("TOO_MANY_ATTEMPTS");

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Checked after the password so this message never confirms which
        // emails have accounts. Shown on the login form (see LoginForm).
        if (user.suspendedAt) throw new Error("ACCOUNT_SUSPENDED");

        // Feeds the "days active" signal on the pilot-testing leaderboard
        // (see /leaderboard) — best-effort, never blocks login.
        await prisma.loginEvent.create({ data: { userId: user.id } }).catch(() => {});

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      // JWT sessions live in the cookie, so suspending an account wouldn't
      // otherwise end one that's already signed in. Looking the user up here
      // means every getServerSession() call sees the suspension straight away
      // — a signed-in-but-suspended user gets no user id, and every page and
      // API route already treats that as signed out.
      const account = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { suspendedAt: true, deletedAt: true },
      });
      if (!account || account.suspendedAt || account.deletedAt) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
};
