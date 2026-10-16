import { prisma } from "@/lib/prisma";

const UK_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The UK calendar date of `date` as "YYYY-MM-DD" (en-CA formats dates that way). */
export function ukDay(date: Date = new Date()): string {
  return UK_DAY.format(date);
}

/**
 * Records that an account used the app today — called from the session
 * callback on every authenticated request, but writes only on the first
 * request of the day (lastActiveDay is read in that callback's existing
 * query, so the common case costs nothing extra). Fire-and-forget: never
 * delays or breaks the request it rides on.
 */
export function recordActiveDay(accountId: string, lastActiveDay: string | null): void {
  const today = ukDay();
  if (lastActiveDay === today) return;
  prisma
    .$transaction([
      prisma.activeDay.upsert({
        where: { accountId_day: { accountId, day: today } },
        create: { accountId, day: today },
        update: {},
      }),
      prisma.account.update({ where: { id: accountId }, data: { lastActiveDay: today } }),
    ])
    .catch(() => {});
}
