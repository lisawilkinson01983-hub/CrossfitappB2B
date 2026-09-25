import { prisma } from "@/lib/prisma";

/**
 * The app's own "Box 2 Box" account — every new signup auto-follows it (see
 * addWelcomeFriend in /api/signup) and it's the sender shown on admin
 * broadcast notices (see /api/admin/notices). Sourced from ADMIN_USER_EMAIL
 * (a real account someone signs into) rather than a fixed id, so which
 * account plays this role can change without a data migration. Returns null
 * if unset or the account doesn't exist — callers treat that as "not
 * configured yet" rather than failing outright.
 */
export async function getSiteAccountId(): Promise<string | null> {
  const email = process.env.ADMIN_USER_EMAIL?.toLowerCase().trim();
  if (!email) return null;

  const account = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return account?.id ?? null;
}
