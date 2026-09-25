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
  const email = configuredSiteAccountEmail();
  if (!email) return null;

  const account = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return account?.id ?? null;
}

function configuredSiteAccountEmail(): string | undefined {
  return process.env.ADMIN_USER_EMAIL?.toLowerCase().trim() || undefined;
}

/**
 * Cheap check for "is this the site account" from an email already in hand
 * (no DB round-trip) — used to hide athlete-only profile fields (area,
 * affiliate gym, ability, CrossFitting since) that don't make sense on the
 * brand account's own profile page. See ProfileDetails.
 */
export function isSiteAccountEmail(email: string): boolean {
  const configured = configuredSiteAccountEmail();
  return Boolean(configured) && email.toLowerCase().trim() === configured;
}
