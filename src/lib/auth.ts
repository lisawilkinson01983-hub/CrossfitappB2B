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

        const account = await prisma.account.findUnique({ where: { email } });
        if (!account) return null;

        const valid = await bcrypt.compare(credentials.password, account.passwordHash);
        if (!valid) return null;

        // Checked after the password so this message never confirms which
        // emails have accounts. Shown on the login form (see LoginForm).
        if (account.suspendedAt) throw new Error("ACCOUNT_SUSPENDED");

        // One login can hold more than one profile (e.g. an athlete profile
        // and the affiliate profile for a gym someone runs — see
        // /settings/profiles). Sign-in always lands on the oldest one; the
        // profile switcher in NavBar handles the rest for this session.
        const profile = await prisma.user.findFirst({
          where: { accountId: account.id },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true },
        });
        if (!profile) return null;

        // Feeds the "days active" signal on the pilot-testing leaderboard
        // (see /leaderboard) — best-effort, never blocks login.
        await prisma.loginEvent.create({ data: { userId: profile.id } }).catch(() => {});

        return { id: profile.id, name: profile.name, email: account.email, accountId: account.id };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        // The Account that actually signed in — kept stable for the life of
        // the token (see below), even once `token.id` moves onto a shared
        // profile owned by someone else's Account (see ProfileAccess).
        token.accountId = user.accountId;
      }
      // Fired by the profile switcher (see /api/account/switch-profile's
      // client call to useSession().update()) — the route itself already
      // verified the target profile is either owned by this Account or
      // shared with it via ProfileAccess, so it's trusted here. Only
      // token.id moves; token.accountId never changes after sign-in, so
      // account-level actions (change email/password, list/add profiles)
      // keep acting on the real login even while viewing a shared profile.
      if (trigger === "update" && session?.switchToProfileId) {
        token.id = session.switchToProfileId;
      }
      return token;
    },
    async session({ session, token }) {
      // JWT sessions live in the cookie, so suspending an account wouldn't
      // otherwise end one that's already signed in. Looking the profile (and
      // its account) up here means every getServerSession() call sees a
      // suspension straight away — a signed-in-but-suspended user gets no
      // user id, and every page and API route already treats that as signed
      // out.
      const profile = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { accountId: true, account: { select: { suspendedAt: true, deletedAt: true } } },
      });
      if (!profile?.account || profile.account.suspendedAt || profile.account.deletedAt) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        // Falls back to this profile's own accountId for a token signed
        // before accountId existed on it (or otherwise missing it) — never
        // leaves this undefined. Every route that scopes a query by
        // session.user.accountId uses Prisma's `where`, and Prisma silently
        // treats an undefined filter value as "no filter" (matches every
        // row) rather than "match nothing" — so an unhealed stale token
        // would leak every account's data, not just deny access to this
        // one's. Self-heals on the very next request without a re-login.
        session.user.accountId = (token.accountId as string | undefined) ?? profile.accountId!;
      }
      return session;
    },
  },
};
