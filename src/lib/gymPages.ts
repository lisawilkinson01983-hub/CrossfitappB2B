import { prisma } from "@/lib/prisma";
import { AFFILIATE_GYMS } from "@/lib/gyms";

// Public details for the fixed listed gyms, gathered from their own site and
// the official CrossFit affiliate directory — used to seed a new gym page
// with something more useful than a bare name. Never overwrites a row an
// admin has already edited (see ensureGymPage below), so this is only ever
// a starting point, not a source of truth kept in sync over time.
//
// Logos live under public/gym-logos/ (checked into git, not the uploads
// volume) since they're fixed app content rather than user uploads.
const KNOWN_GYM_INFO: Partial<
  Record<string, { description: string; address: string; website: string; photo?: string }>
> = {
  "CrossFit Uckfield": {
    description:
      "CrossFit Uckfield operates out of The Paleo Gym, running one classic CrossFit class a day with a constantly varied programme that mixes cardio, gymnastics and weightlifting, coached throughout the session. Alongside general CrossFit classes, they run a Junior Hero Academy for kids and CrossFit Teens, Third Age CrossFit for older athletes, and Quiet Classes for anyone who prefers a smaller, lower-sensory environment, plus modified sessions for anyone recovering from injury or illness and personalised nutrition support.",
    address: "Crockstead Farm, Eastbourne Road, Halland, East Sussex, BN8 6PT",
    website: "https://www.thepaleogym.co.uk/",
    photo: "/gym-logos/crossfit-uckfield.jpg",
  },
  "CrossFit Crowborough": {
    description:
      "CrossFit Crowborough runs group classes that combine gymnastics, weightlifting and conditioning, with coaches teaching the foundational movements and scaling each workout to the athlete's fitness level. The box also supports members competing in the CrossFit Open and in-house competitions, alongside a supportive, all-levels community.",
    address: "Unit 5, Beacon Business Park, Crowborough, East Sussex, TN6 2GD",
    website: "https://www.crossfitcrowborough.com",
    photo: "/gym-logos/crossfit-crowborough.png",
  },
  "CrossFit Hailsham (FFH)": {
    description:
      "CrossFit FFH (Fortior Fit Hailsham) scales every workout to the athlete, whether they're lifting for the first time, managing an injury, or training at a high level. Alongside CrossFit classes, they offer sports massage, personal training and nutritional guidance, with a community that spans teachers, tradespeople, parents, students and retirees training side by side.",
    address: "16 Diplocks Way, Hailsham, East Sussex, BN27 3JY",
    website: "https://www.fortiorfithailsham.com/",
    photo: "/gym-logos/crossfit-hailsham-ffh.png",
  },
  "CrossFit Burgess Hill (BYS)": {
    description:
      "BYS CrossFit combines mobility and high-intensity training across cardio, gymnastics, powerlifting and Olympic lifting, with dedicated barbell classes focused on the clean & jerk and snatch and gymnastics classes covering everything from pull-ups to handstand walking. It's run as a supportive, inclusive community for all fitness levels.",
    address: "Unit 6 Sovereign Business Park, Albert Drive, Burgess Hill, RH15 9TY",
    website: "https://www.bysfitness.co.uk/byscrossfit",
    photo: "/gym-logos/crossfit-burgess-hill-bys.png",
  },
};

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
