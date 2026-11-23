import { prisma } from "@/lib/prisma";
import { WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { formatEventDate } from "@/lib/eventDate";
import { assertEventVisible } from "@/lib/eventVisibility";
import { resultHeadline, isPodiumPlace } from "@/lib/eventResults";
import { photoToDataUri } from "./photo";
import type { FeedStoryAProps, FeedStoryBProps, FeedStoryCProps, ResultCardProps } from "./templates";

/**
 * The "name" line a Result card shows, plus who to list underneath it —
 * "Team {name}" and its full roster (registered teammates' first names,
 * plus anyone added as a freeform not-on-the-app name) for a team result,
 * or just the individual's own name with no roster line otherwise. Shared
 * by loadFeedStoryData and loadEventResultCardData so the feed-share and
 * leaderboard-share paths always agree on how a team result reads.
 */
function resultAttribution(
  individualName: string,
  team: { name: string; members: { user: { name: string } }[] } | null,
  freeformTeammateNames: string | null
): { name: string; teamMembers: string[] | null } {
  if (!team) return { name: individualName, teamMembers: null };
  const freeform: string[] = freeformTeammateNames ? JSON.parse(freeformTeammateNames) : [];
  const members = [...team.members.map((m) => m.user.name.split(" ")[0]), ...freeform];
  return { name: `Team ${team.name}`, teamMembers: members.length > 0 ? members : null };
}

/**
 * Loads a post (with the same visibility rule as viewing it in the feed —
 * its own author, or anyone, since posts aren't otherwise access-controlled
 * here beyond block/mute, which the share action doesn't need to re-check)
 * and the current user's chosen photo override, then builds the props for
 * whichever Feed Story format was requested. A result post (see
 * linkedEventResult) has no score/label of its own — it gets `result`
 * instead of `a`/`b`/`c`, and the caller picks a Result template instead.
 */
export async function loadFeedStoryData(
  postId: string,
  userId: string,
  photoOverride: string | null
): Promise<
  | { kind: "workout"; a: FeedStoryAProps; b: FeedStoryBProps; c: FeedStoryCProps }
  | { kind: "result"; result: ResultCardProps }
  | null
> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      user: { select: { id: true, name: true, photo: true } },
      linkedWorkout: true,
      linkedEventResult: {
        select: {
          place: true,
          placementType: true,
          totalCompetitors: true,
          division: true,
          freeformTeammateNames: true,
          event: { select: { name: true, photo: true, isOnline: true, location: true } },
          team: { select: { name: true, members: { select: { user: { select: { name: true } } } } } },
        },
      },
      linkedEvent: {
        select: { name: true, photo: true, date: true, endDate: true, isOnline: true, location: true },
      },
      media: { orderBy: { order: "asc" }, take: 1, where: { kind: "PHOTO" } },
    },
  });
  if (!post) return null;

  if (post.linkedEventResult) {
    const r = post.linkedEventResult;
    const photoUrl = photoOverride ?? r.event.photo;
    const photo = await photoToDataUri(photoUrl);
    const { name, teamMembers } = resultAttribution(post.user.name, r.team, r.freeformTeammateNames);
    return {
      kind: "result",
      result: {
        name,
        teamMembers,
        photo,
        headline: resultHeadline(r),
        competitorsLine:
          r.placementType === "EXACT" && r.place != null && r.totalCompetitors != null && !isPodiumPlace(r.place)
            ? `of ${r.totalCompetitors} competitors`
            : null,
        eventName: r.event.name,
        divisionLocation: [r.division, r.event.isOnline ? "Online" : r.event.location].filter(Boolean).join(" · "),
      },
    };
  }

  // A "joined this event"/"started a team" post (see POST
  // /api/events/[id]/participate) has no workout score of its own either —
  // same Result-card family, just reusing its slots differently: the
  // event's own name is the headline (the one thing worth sharing) and the
  // date/location sits under it. Deliberately not showing contentText (a
  // team-formed note) here — just the plain "attending" card, per
  // feedback. TEAMMATE_REQUEST posts are excluded, same as the feed's own
  // linkedEvent card (see PostCard) — that type gets its own share flow.
  if (post.linkedEvent && post.type !== "TEAMMATE_REQUEST") {
    const e = post.linkedEvent;
    const photoUrl = photoOverride ?? e.photo;
    const photo = await photoToDataUri(photoUrl);
    return {
      kind: "result",
      result: {
        name: post.user.name,
        photo,
        headline: e.name,
        competitorsLine: [formatEventDate(e), e.isOnline ? "Online" : e.location].filter(Boolean).join(" · "),
        eventName: null,
        divisionLocation: null,
        badgeLabel: "Attending",
      },
    };
  }

  const postPhotoUrl = photoOverride ?? post.media[0]?.url ?? post.photo ?? post.user.photo;
  const avatarUrl = photoOverride ?? post.user.photo;
  const [postPhoto, avatar] = await Promise.all([photoToDataUri(postPhotoUrl), photoToDataUri(avatarUrl)]);

  const w = post.linkedWorkout;
  const score = w ? (w.unit === "ROUNDS_REPS" ? `${w.rounds ?? 0} + ${w.reps ?? 0}` : (w.score ?? "—")) : "";
  const label = w ? `${WORKOUT_UNIT_LABELS[w.unit]} · ${WORKOUT_INTENSITY_LABELS[w.intensity]}` : "";
  const scoreLabel = w ? WORKOUT_UNIT_LABELS[w.unit] : "";
  const badge = w ? WORKOUT_INTENSITY_LABELS[w.intensity] : "";

  const stats =
    w && w.unit === "ROUNDS_REPS"
      ? [
          { value: String(w.rounds ?? 0), label: "Rounds" },
          { value: String(w.reps ?? 0), label: "Reps" },
        ]
      : [];

  return {
    kind: "workout",
    a: { name: post.user.name, photo: postPhoto, score, label, description: w?.description ?? null, wodName: w?.wodName ?? "" },
    b: { name: post.user.name, photo: avatar, quote: post.contentText ?? "" },
    c: {
      name: post.user.name,
      photo: avatar,
      date: formatDate(post.createdAt, { day: "numeric", month: "short" }),
      scoreLabel,
      score,
      badge,
      wodName: w?.wodName ?? "",
      description: w?.description ?? null,
      stats,
    },
  };
}

/**
 * Same FeedStoryA/B/C shape as loadFeedStoryData, but sourced straight from
 * a Workout row instead of a Post — so a workout that was never (and may
 * never be) shared to the feed can still be shared to Stories/Instagram/a
 * DM. Only the workout's own owner can render it; `userId` is the viewer
 * from the session, checked against the row, not just used to look it up.
 */
export async function loadWorkoutCardData(
  workoutId: string,
  userId: string,
  photoOverride: string | null
): Promise<{ a: FeedStoryAProps; b: FeedStoryBProps; c: FeedStoryCProps } | null> {
  const w = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: { user: { select: { id: true, name: true, photo: true } } },
  });
  if (!w || w.userId !== userId) return null;

  const cardPhotoUrl = photoOverride ?? w.photo ?? w.user.photo;
  const avatarUrl = photoOverride ?? w.user.photo;
  const [cardPhoto, avatar] = await Promise.all([photoToDataUri(cardPhotoUrl), photoToDataUri(avatarUrl)]);

  const score = w.unit === "ROUNDS_REPS" ? `${w.rounds ?? 0} + ${w.reps ?? 0}` : w.score ?? "—";
  const label = `${WORKOUT_UNIT_LABELS[w.unit]} · ${WORKOUT_INTENSITY_LABELS[w.intensity]}`;
  const stats =
    w.unit === "ROUNDS_REPS"
      ? [
          { value: String(w.rounds ?? 0), label: "Rounds" },
          { value: String(w.reps ?? 0), label: "Reps" },
        ]
      : [];

  return {
    a: { name: w.user.name, photo: cardPhoto, score, label, description: w.description ?? null, wodName: w.wodName },
    b: { name: w.user.name, photo: avatar, quote: w.notes ?? "" },
    c: {
      name: w.user.name,
      photo: avatar,
      date: formatDate(w.createdAt, { day: "numeric", month: "short" }),
      scoreLabel: WORKOUT_UNIT_LABELS[w.unit],
      score,
      badge: WORKOUT_INTENSITY_LABELS[w.intensity],
      wodName: w.wodName,
      description: w.description ?? null,
      stats,
    },
  };
}

/**
 * Same Result-card shape as loadFeedStoryData's `result` branch, but sourced
 * straight from an EventResult row instead of a Post — lets the leaderboard
 * on /events/[id]/results offer a share action for any row, not only the one
 * (if any) its logger has already posted to the feed. Visibility matches the
 * results page itself (same private-event rule as viewing it there), not
 * ownership — the card shows nothing the viewer couldn't already see listed
 * on that page. A team row uses the team's own name/roster photo instead of
 * a single person's, same simplification TeamResultRow itself makes.
 */
async function buildEventResultCardData(resultId: string, photoOverride: string | null) {
  const r = await prisma.eventResult.findUnique({
    where: { id: resultId },
    select: {
      place: true,
      placementType: true,
      totalCompetitors: true,
      division: true,
      freeformTeammateNames: true,
      user: { select: { name: true } },
      team: { select: { name: true, members: { select: { user: { select: { name: true } } } } } },
      event: {
        select: { id: true, name: true, photo: true, isOnline: true, location: true, isPrivate: true, status: true, createdById: true, submittedById: true },
      },
    },
  });
  if (!r) return null;

  const photoUrl = photoOverride ?? r.event.photo;
  const photo = await photoToDataUri(photoUrl);
  const { name, teamMembers } = resultAttribution(r.user.name, r.team, r.freeformTeammateNames);
  const card: ResultCardProps = {
    name,
    teamMembers,
    photo,
    headline: resultHeadline(r),
    competitorsLine:
      r.placementType === "EXACT" && r.place != null && r.totalCompetitors != null && !isPodiumPlace(r.place)
        ? `of ${r.totalCompetitors} competitors`
        : null,
    eventName: r.event.name,
    divisionLocation: [r.division, r.event.isOnline ? "Online" : r.event.location].filter(Boolean).join(" · "),
  };
  return { card, event: r.event };
}

export async function loadEventResultCardData(
  resultId: string,
  viewerId: string,
  photoOverride: string | null
): Promise<ResultCardProps | null> {
  const built = await buildEventResultCardData(resultId, photoOverride);
  if (!built) return null;
  if (!(await assertEventVisible(built.event, viewerId))) return null;
  return built.card;
}

/**
 * Same card, but for the public (no-login) result share link — see
 * loadPublicPost's equivalent reasoning on the post side. A private event's
 * result is never served here, same rule as assertEventVisible's own
 * public branch, just without a viewer to check participation/invite for.
 */
export async function loadPublicEventResultCardData(resultId: string): Promise<ResultCardProps | null> {
  const built = await buildEventResultCardData(resultId, null);
  if (!built) return null;
  if (built.event.isPrivate || built.event.status !== "APPROVED") return null;
  return built.card;
}
