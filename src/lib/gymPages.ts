import { prisma } from "@/lib/prisma";
import { AFFILIATE_GYMS } from "@/lib/gyms";
import affiliateGyms from "@/lib/affiliateGyms.json";

// Public details for the fixed listed gyms, gathered from their own site and
// the official CrossFit affiliate directory — used to seed a new gym page
// with something more useful than a bare name. Never overwrites a row an
// admin has already edited (see ensureGymPage below), so this is only ever
// a starting point, not a source of truth kept in sync over time.
//
// Shared with scripts/backfill-gym-pages.js via affiliateGyms.json. Logos
// live under public/gym-logos/ (checked into git, not the uploads volume)
// since they're fixed app content rather than user uploads; a gym without
// one falls back to the generic gym icon (see Avatar's `fallback`).
const KNOWN_GYM_INFO: Partial<
  Record<string, { description: string; address: string; website: string; photo?: string }>
> = Object.fromEntries(affiliateGyms.map(({ name, ...info }) => [name, info]));

/**
 * Gym pages are database-only (no in-app creation form) to avoid
 * user-submitted duplicates/errors — but a bare page should still exist
 * the moment anyone actually picks one of the fixed listed gyms as their
 * affiliate, rather than 404ing until someone manually adds it via Prisma
 * Studio. Leaves an existing (possibly admin-filled-in) row untouched, and
 * only ever fills in a field when it's still empty.
 */
export async function ensureGymPage(name: string): Promise<void> {
  if (!(AFFILIATE_GYMS as readonly string[]).includes(name)) return;

  const known = KNOWN_GYM_INFO[name];

  const gym = await prisma.gym.upsert({
    where: { name },
    create: { name, ...known },
    update: {},
  });

  if (!known) return;

  // Backfill known details onto a bare row created before this info
  // existed — each field only fills in if it's still empty, so an admin
  // edit to any one of them is never overwritten.
  const fill: { description?: string; address?: string; website?: string; photo?: string } = {};
  if (!gym.description && known.description) fill.description = known.description;
  if (!gym.address && known.address) fill.address = known.address;
  if (!gym.website && known.website) fill.website = known.website;
  if (!gym.photo && known.photo) fill.photo = known.photo;

  if (Object.keys(fill).length > 0) {
    await prisma.gym.update({ where: { name }, data: fill });
  }
}

/**
 * The AFFILIATE profile that's been verified as running this gym, if any
 * (see Gym.claimedById) — set only once an admin approves their "I run this
 * gym" request, so an account that's merely typed a gym's name into its own
 * affiliateGym field can't intercept that gym's booking requests.
 */
export async function findVerifiedGymOwner(gymName: string) {
  const gym = await prisma.gym.findUnique({ where: { name: gymName }, select: { claimedBy: { select: { id: true } } } });
  return gym?.claimedBy ?? null;
}
