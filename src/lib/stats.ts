import { prisma } from "@/lib/prisma";
import { ukDay } from "@/lib/activity";

/**
 * Numbers behind the admin dashboard at /admin/stats. Everything counts
 * people (Accounts), not profiles — someone with an athlete profile and a
 * gym profile is one member. "Active" means an ActiveDay row: they used the
 * app that day (see src/lib/activity.ts). Days are UK calendar days.
 */

export type DayPoint = { day: string; active: number; signups: number };

export type Cohort = {
  weekStart: string;
  size: number;
  // Share of the cohort active in week 1..4 after signing up; null while
  // that week hasn't finished yet.
  weeks: (number | null)[];
};

export type ActivityTotal = { key: string; label: string; current: number; previous: number };

export type Adoption = { label: string; people: number };

export type Stats = {
  days: number;
  totalMembers: number;
  signups: number;
  previousSignups: number;
  activeToday: number;
  active7: number;
  active30: number;
  activeInRange: number;
  // Of people who signed up at least 7 days ago, the share who came back on
  // any of the 7 days after their signup day; null when nobody qualifies yet.
  firstWeekReturn: { rate: number | null; eligible: number };
  invitedSignups: number;
  daily: DayPoint[];
  activity: ActivityTotal[];
  adoption: Adoption[];
  cohorts: Cohort[];
};

/** Shifts a "YYYY-MM-DD" day string by `n` days (calendar arithmetic, no time zones involved). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `day`. */
function weekStart(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

const COHORT_WEEKS = 8;
const RETENTION_WEEKS = 4;

export async function buildStats({ days, testGroup }: { days: number; testGroup?: string }): Promise<Stats> {
  const today = ukDay();
  const rangeStart = addDays(today, -(days - 1));
  const previousStart = addDays(rangeStart, -days);
  const now = Date.now();
  const since = new Date(now - days * 86400000);
  const previousSince = new Date(now - 2 * days * 86400000);

  const accounts = await prisma.account.findMany({
    where: { deletedAt: null, ...(testGroup ? { profiles: { some: { testGroup } } } : {}) },
    select: { id: true, createdAt: true, profiles: { select: { id: true, invitedById: true } } },
  });
  const accountIds = accounts.map((a) => a.id);
  const accountOfProfile = new Map<string, string>();
  for (const a of accounts) for (const p of a.profiles) accountOfProfile.set(p.id, a.id);
  const profileIds = [...accountOfProfile.keys()];
  const signupDay = new Map(accounts.map((a) => [a.id, ukDay(a.createdAt)]));

  // Far enough back for the range, the previous range, and every cohort's
  // retention weeks.
  const oldestCohortWeek = addDays(weekStart(today), -7 * (COHORT_WEEKS - 1));
  const historyStart = [previousStart, addDays(today, -30), oldestCohortWeek].sort()[0];
  const activeRows = await prisma.activeDay.findMany({
    where: { accountId: { in: accountIds }, day: { gte: historyStart } },
    select: { accountId: true, day: true },
  });
  const activeDaysOf = new Map<string, Set<string>>();
  for (const { accountId, day } of activeRows) {
    if (!activeDaysOf.has(accountId)) activeDaysOf.set(accountId, new Set());
    activeDaysOf.get(accountId)!.add(day);
  }

  const activeSince = (start: string) =>
    new Set(activeRows.filter((r) => r.day >= start).map((r) => r.accountId)).size;

  // Daily series.
  const activeByDay = new Map<string, number>();
  for (const { day } of activeRows) activeByDay.set(day, (activeByDay.get(day) ?? 0) + 1);
  const signupsByDay = new Map<string, number>();
  for (const day of signupDay.values()) signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
  const daily: DayPoint[] = [];
  for (let day = rangeStart; day <= today; day = addDays(day, 1)) {
    daily.push({ day, active: activeByDay.get(day) ?? 0, signups: signupsByDay.get(day) ?? 0 });
  }

  const signupsBetween = (start: string, end: string) =>
    [...signupDay.values()].filter((d) => d >= start && d <= end).length;
  const invitedSignups = accounts.filter(
    (a) => signupDay.get(a.id)! >= rangeStart && a.profiles.some((p) => p.invitedById)
  ).length;

  // First-week return: came back on any of the 7 days after signing up.
  const eligible = accounts.filter((a) => signupDay.get(a.id)! <= addDays(today, -7));
  const returned = eligible.filter((a) => {
    const start = signupDay.get(a.id)!;
    const seen = activeDaysOf.get(a.id);
    if (!seen) return false;
    for (let i = 1; i <= 7; i++) if (seen.has(addDays(start, i))) return true;
    return false;
  }).length;

  // Weekly signup cohorts and their week-1..4 retention.
  const cohorts: Cohort[] = [];
  for (let w = COHORT_WEEKS - 1; w >= 0; w--) {
    const ws = addDays(weekStart(today), -7 * w);
    const members = accounts.filter((a) => weekStart(signupDay.get(a.id)!) === ws);
    const weeks: (number | null)[] = [];
    for (let k = 1; k <= RETENTION_WEEKS; k++) {
      // A cohort's week k is finished once its last member's week k has.
      const lastDayOfWindow = addDays(ws, 6 + 7 * k + 6);
      if (members.length === 0 || lastDayOfWindow > today) {
        weeks.push(null);
        continue;
      }
      const retained = members.filter((a) => {
        const start = signupDay.get(a.id)!;
        const seen = activeDaysOf.get(a.id);
        if (!seen) return false;
        for (let i = 7 * k; i < 7 * k + 7; i++) if (seen.has(addDays(start, i))) return true;
        return false;
      }).length;
      weeks.push(retained / members.length);
    }
    cohorts.push({ weekStart: ws, size: members.length, weeks });
  }

  // Activity totals, this period vs the one before.
  const inRange = (gte: Date, lt?: Date) => ({ createdAt: { gte, ...(lt ? { lt } : {}) } });
  const byProfile = { userId: { in: profileIds } };
  const counters: { key: string; label: string; count: (w: object) => Promise<number> }[] = [
    { key: "posts", label: "Posts", count: (w) => prisma.post.count({ where: { ...byProfile, ...w } }) },
    { key: "comments", label: "Comments", count: (w) => prisma.comment.count({ where: { ...byProfile, ...w } }) },
    { key: "likes", label: "Likes", count: (w) => prisma.like.count({ where: { ...byProfile, ...w } }) },
    {
      key: "messages",
      label: "Messages",
      count: (w) => prisma.message.count({ where: { senderId: { in: profileIds }, ...w } }),
    },
    { key: "workouts", label: "Workouts logged", count: (w) => prisma.workout.count({ where: { ...byProfile, ...w } }) },
    {
      key: "events",
      label: "Event sign-ups",
      count: (w) => prisma.eventParticipant.count({ where: { ...byProfile, ...w } }),
    },
    { key: "stories", label: "Stories", count: (w) => prisma.story.count({ where: { ...byProfile, ...w } }) },
  ];
  const activity = await Promise.all(
    counters.map(async (c) => ({
      key: c.key,
      label: c.label,
      current: await c.count(inRange(since)),
      previous: await c.count(inRange(previousSince, since)),
    }))
  );

  // Feature adoption: how many people did each thing at least once in range.
  const distinctAccounts = (rows: { id: string }[]) =>
    new Set(rows.map((r) => accountOfProfile.get(r.id)).filter(Boolean)).size;
  const usersWho = <T extends { userId: string }>(rows: T[]) => distinctAccounts(rows.map((r) => ({ id: r.userId })));
  const w = { ...byProfile, ...inRange(since) };
  const [posted, commented, liked, messaged, workedOut, joinedEvent] = await Promise.all([
    prisma.post.findMany({ where: w, select: { userId: true }, distinct: ["userId"] }).then(usersWho),
    prisma.comment.findMany({ where: w, select: { userId: true }, distinct: ["userId"] }).then(usersWho),
    prisma.like.findMany({ where: w, select: { userId: true }, distinct: ["userId"] }).then(usersWho),
    prisma.message
      .findMany({
        where: { senderId: { in: profileIds }, ...inRange(since) },
        select: { senderId: true },
        distinct: ["senderId"],
      })
      .then((rows) => distinctAccounts(rows.map((r) => ({ id: r.senderId })))),
    prisma.workout.findMany({ where: w, select: { userId: true }, distinct: ["userId"] }).then(usersWho),
    prisma.eventParticipant.findMany({ where: w, select: { userId: true }, distinct: ["userId"] }).then(usersWho),
  ]);
  const adoption: Adoption[] = [
    { label: "Liked something", people: liked },
    { label: "Posted", people: posted },
    { label: "Commented", people: commented },
    { label: "Sent a message", people: messaged },
    { label: "Logged a workout", people: workedOut },
    { label: "Signed up to an event", people: joinedEvent },
  ].sort((a, b) => b.people - a.people);

  return {
    days,
    totalMembers: accounts.length,
    signups: signupsBetween(rangeStart, today),
    previousSignups: signupsBetween(previousStart, addDays(rangeStart, -1)),
    activeToday: activeSince(today),
    active7: activeSince(addDays(today, -6)),
    active30: activeSince(addDays(today, -29)),
    activeInRange: activeSince(rangeStart),
    firstWeekReturn: { rate: eligible.length ? returned / eligible.length : null, eligible: eligible.length },
    invitedSignups,
    daily,
    activity,
    adoption,
    cohorts,
  };
}
