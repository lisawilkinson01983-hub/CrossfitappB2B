import { prisma } from "@/lib/prisma";
import { ukDay } from "@/lib/activity";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";

export type GymWodSuggestion = {
  wodName: string;
  description: string;
  authorName: string;
};

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

/**
 * The most recent workout someone else at the same affiliate gym logged
 * today (UK calendar day, matching the rest of the app's "today" — see
 * ukDay), if any — so a second person from the same gym can reuse its
 * name/description instead of retyping their box's WOD of the day. Only
 * ever a suggestion: posting still creates the usual separate Workout row,
 * scored by whoever logs it.
 */
export async function getGymWodSuggestion(userId: string): Promise<GymWodSuggestion | null> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { affiliateGym: true, affiliateGymOther: true },
  });
  const myKey = me ? gymKey(me.affiliateGym, me.affiliateGymOther) : null;
  if (!myKey) return null;

  const today = ukDay();
  const recent = await prisma.workout.findMany({
    where: {
      userId: { not: userId },
      // Cheap DB-level floor — today's rows (if any) are always the most
      // recent, so this just keeps the scan small; the real "is it today"
      // check is the UK-calendar-day comparison below.
      createdAt: { gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      wodName: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      wodName: true,
      description: true,
      createdAt: true,
      user: { select: { name: true, affiliateGym: true, affiliateGymOther: true } },
    },
  });

  for (const workout of recent) {
    if (ukDay(workout.createdAt) !== today) break; // date-desc ordered — nothing after this is today either
    if (!workout.description?.trim()) continue;
    if (gymKey(workout.user.affiliateGym, workout.user.affiliateGymOther) !== myKey) continue;
    return { wodName: workout.wodName, description: workout.description, authorName: workout.user.name };
  }
  return null;
}
