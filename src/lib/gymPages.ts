import { prisma } from "@/lib/prisma";
import { AFFILIATE_GYMS } from "@/lib/gyms";

// Public details for the fixed listed gyms, gathered from their own site and
// the official CrossFit affiliate directory — used to seed a new gym page
// with something more useful than a bare name. Never overwrites a row an
// admin has already edited (see ensureGymPage below), so this is only ever
// a starting point, not a source of truth kept in sync over time.
const KNOWN_GYM_INFO: Partial<Record<string, { description: string; address: string; website: string }>> = {
  "CrossFit Uckfield": {
    description:
      "CrossFit Uckfield operates out of The Paleo Gym, running one classic CrossFit class a day with a constantly varied programme that mixes cardio, gymnastics and weightlifting, coached throughout the session. Alongside general CrossFit classes, they run a Junior Hero Academy for kids and CrossFit Teens, Third Age CrossFit for older athletes, and Quiet Classes for anyone who prefers a smaller, lower-sensory environment, plus modified sessions for anyone recovering from injury or illness and personalised nutrition support.",
    address: "Crockstead Farm, Eastbourne Road, Halland, East Sussex, BN8 6PT",
    website: "https://www.thepaleogym.co.uk/",
  },
};

/**
 * Gym pages are database-only (no in-app creation form) to avoid
 * user-submitted duplicates/errors — but a bare page should still exist
 * the moment anyone actually picks one of the fixed listed gyms as their
 * affiliate, rather than 404ing until someone manually adds it via Prisma
 * Studio. Leaves an existing (possibly admin-filled-in) row untouched, and
 * only ever fills in description/address/website when they're still empty.
 */
export async function ensureGymPage(name: string): Promise<void> {
  if (!(AFFILIATE_GYMS as readonly string[]).includes(name)) return;

  const known = KNOWN_GYM_INFO[name];

  const gym = await prisma.gym.upsert({
    where: { name },
    create: { name, ...known },
    update: {},
  });

  // Backfill known details onto a bare row created before this info
  // existed — but never touch one that already has anything filled in.
  if (known && !gym.description && !gym.address && !gym.website) {
    await prisma.gym.update({ where: { name }, data: known });
  }
}
