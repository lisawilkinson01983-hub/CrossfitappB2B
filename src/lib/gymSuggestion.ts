import { prisma } from "@/lib/prisma";
import { ukDay } from "@/lib/activity";
import { formatDate } from "@/lib/dates";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";

// How many calendar days back a gym's WOD list reaches — someone logging
// late (e.g. Wednesday for Monday's class) can still find and reuse it.
const WEEK_DAYS = 7;
// A safety cap on the browsable gym list (every approved gym, see below),
// not just the ones with activity — keeps the picker bounded if the
// approved-gym list ever grows very large. Sorting puts the viewer's own
// gym and anything active this week first, so this only ever trims off
// inactive gyms, never the ones someone actually wants to see.
const MAX_GYMS = 100;

// wodName/description null means nothing was logged at this gym on this
// day — a real, always-present row (see getGymWodWeek), not a missing one.
export type GymWodDay = { key: string; label: string; wodName: string | null; description: string | null };
export type GymWodGym = { key: string; name: string; days: GymWodDay[] };
export type GymWodWeek = { gyms: GymWodGym[]; myGymKey: string | null };

// A stable key for "same gym" grouping, folding the free-text "Other" case
// in with everyone else's curated selection — two people who both picked
// "Other" only match if they typed (trimmed, case-insensitive) the same
// name, same as nobody else matching an empty/unset gym.
function gymKey(affiliateGym: string | null, affiliateGymOther: string | null): string | null {
  if (!affiliateGym || affiliateGym === UNAFFILIATED) return null;
  if (affiliateGym === OTHER_GYM) {
    const other = affiliateGymOther?.trim().toLowerCase();
    return other ? `other:${other}` : null;
  }
  return `gym:${affiliateGym}`;
}

function gymDisplayName(affiliateGym: string | null, affiliateGymOther: string | null): string {
  if (affiliateGym === OTHER_GYM) return affiliateGymOther?.trim() || "Other";
  return affiliateGym ?? "";
}

function dayLabel(date: Date, today: string, yesterday: string): string {
  const day = ukDay(date);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return formatDate(date, { weekday: "short", day: "numeric" }); // "Mon 10"
}

/**
 * Every browsable gym's last week, day by day — so someone logging a
 * workout can reuse an already-logged WOD's name/description instead of
 * retyping it, whether it's today's class at their own box or they're
 * catching up on an older day, and whether it's their own gym or
 * (deliberately) anyone else's. Every gym always has exactly WEEK_DAYS
 * entries, "Today" first, so the day chips never shift around between
 * gyms — a day with nothing logged just carries null wodName/description
 * for the UI to render as "Nothing logged" rather than being left out.
 * Never names who logged it — only the gym and the day. Only ever a
 * suggestion: posting still creates the usual separate Workout row, scored
 * by whoever logs it.
 */
export async function getGymWodWeek(userId: string): Promise<GymWodWeek | null> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { affiliateGym: true, affiliateGymOther: true },
  });
  const myKey = me ? gymKey(me.affiliateGym, me.affiliateGymOther) : null;

  const today = ukDay();
  const yesterday = ukDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
  // A day's cushion past WEEK_DAYS covers the gap between a UTC "gte" floor
  // and the UK calendar day boundary this all actually keys off of.
  const since = new Date(Date.now() - (WEEK_DAYS + 1) * 24 * 60 * 60 * 1000);

  const [recent, approvedGyms] = await Promise.all([
    prisma.workout.findMany({
      where: {
        userId: { not: userId },
        createdAt: { gte: since },
        wodName: { not: "" },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        wodName: true,
        description: true,
        createdAt: true,
        user: { select: { affiliateGym: true, affiliateGymOther: true } },
      },
    }),
    // The full list of gyms someone can switch to — every curated/approved
    // gym, whether or not anyone there has logged anything this week (see
    // below for "Other" free-text gyms, which aren't on this list).
    prisma.gym.findMany({ where: { status: "APPROVED" }, select: { name: true } }),
  ]);

  const activityByGym = new Map<string, { name: string; days: Map<string, { wodName: string; description: string }> }>();
  for (const w of recent) {
    const key = gymKey(w.user.affiliateGym, w.user.affiliateGymOther);
    if (!key) continue;

    let gym = activityByGym.get(key);
    if (!gym) {
      gym = { name: gymDisplayName(w.user.affiliateGym, w.user.affiliateGymOther), days: new Map() };
      activityByGym.set(key, gym);
    }
    if (gym.days.size >= WEEK_DAYS) continue; // this gym's week is already full

    const dayKey = ukDay(w.createdAt);
    if (gym.days.has(dayKey)) continue; // already have that day's (most recent) entry — recent is date-desc

    gym.days.set(dayKey, { wodName: w.wodName, description: w.description ?? "" });
  }

  // Union of every approved gym, plus any "Other" free-text gym that
  // actually has activity (there's no canonical list of those to browse
  // otherwise), plus the viewer's own gym even on the off chance it isn't
  // (yet) marked approved — their own gym always has to be in the list.
  const allGyms = new Map<string, string>(); // key -> display name
  for (const g of approvedGyms) allGyms.set(`gym:${g.name}`, g.name);
  for (const [key, data] of activityByGym) allGyms.set(key, data.name);
  if (myKey && !allGyms.has(myKey)) {
    allGyms.set(myKey, gymDisplayName(me?.affiliateGym ?? null, me?.affiliateGymOther ?? null));
  }

  if (allGyms.size === 0) return null;

  const weekDays = Array.from({ length: WEEK_DAYS }, (_, i) => {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    return { key: ukDay(date), label: dayLabel(date, today, yesterday) };
  });

  const gyms: GymWodGym[] = Array.from(allGyms.entries())
    .map(([key, name]) => {
      const activity = activityByGym.get(key);
      const days: GymWodDay[] = weekDays.map(({ key: dayKey, label }) => {
        const entry = activity?.days.get(dayKey);
        return { key: dayKey, label, wodName: entry?.wodName ?? null, description: entry?.description ?? null };
      });
      return { key, name, days };
    })
    .sort((a, b) => {
      if (a.key === myKey) return -1;
      if (b.key === myKey) return 1;
      const aActive = a.days.some((d) => d.wodName != null);
      const bActive = b.days.some((d) => d.wodName != null);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_GYMS);

  return { gyms, myGymKey: myKey };
}
