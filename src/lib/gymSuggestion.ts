import { prisma } from "@/lib/prisma";
import { ukDay } from "@/lib/activity";
import { formatDate } from "@/lib/dates";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";

// How many calendar days back a gym's WOD list reaches — someone logging
// late (e.g. Wednesday for Monday's class) can still find and reuse it.
const WEEK_DAYS = 7;
// Most gyms with any activity this week; keeps the picker from growing
// unbounded on a busy app.
const MAX_GYMS = 8;

export type GymWodDay = { key: string; label: string; wodName: string; description: string };
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
 * The last week's worth of WODs logged at every gym with any activity,
 * grouped by gym then by day — so someone logging a workout can reuse an
 * already-logged WOD's name/description instead of retyping it, whether
 * it's today's class at their own box or they're catching up on an older
 * day, and whether it's their own gym or (deliberately) anyone else's.
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

  const recent = await prisma.workout.findMany({
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
  });

  const byGym = new Map<string, { name: string; days: Map<string, GymWodDay> }>();
  for (const w of recent) {
    if (!w.description?.trim()) continue;
    const key = gymKey(w.user.affiliateGym, w.user.affiliateGymOther);
    if (!key) continue;

    let gym = byGym.get(key);
    if (!gym) {
      gym = { name: gymDisplayName(w.user.affiliateGym, w.user.affiliateGymOther), days: new Map() };
      byGym.set(key, gym);
    }
    if (gym.days.size >= WEEK_DAYS) continue; // this gym's week is already full

    const dayKey = ukDay(w.createdAt);
    if (gym.days.has(dayKey)) continue; // already have that day's (most recent) entry — recent is date-desc

    gym.days.set(dayKey, {
      key: dayKey,
      label: dayLabel(w.createdAt, today, yesterday),
      wodName: w.wodName,
      description: w.description,
    });
  }

  if (byGym.size === 0) return null;

  const gyms: GymWodGym[] = Array.from(byGym.entries())
    .map(([key, g]) => ({ key, name: g.name, days: Array.from(g.days.values()) }))
    .sort((a, b) => {
      if (a.key === myKey) return -1;
      if (b.key === myKey) return 1;
      return (b.days[0]?.key ?? "").localeCompare(a.days[0]?.key ?? "");
    })
    .slice(0, MAX_GYMS);

  return { gyms, myGymKey: myKey };
}
