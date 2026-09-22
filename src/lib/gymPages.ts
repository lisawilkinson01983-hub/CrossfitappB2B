import { prisma } from "@/lib/prisma";
import { AFFILIATE_GYMS } from "@/lib/gyms";

/**
 * Gym pages are database-only (no in-app creation form) to avoid
 * user-submitted duplicates/errors — but a bare page should still exist
 * the moment anyone actually picks one of the fixed listed gyms as their
 * affiliate, rather than 404ing until someone manually adds it via Prisma
 * Studio. Leaves an existing (possibly admin-filled-in) row untouched.
 */
export async function ensureGymPage(name: string): Promise<void> {
  if (!(AFFILIATE_GYMS as readonly string[]).includes(name)) return;

  await prisma.gym.upsert({
    where: { name },
    create: { name },
    update: {},
  });
}
