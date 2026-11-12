import { prisma } from "@/lib/prisma";
import { WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { resultHeadline, isPodiumPlace } from "@/lib/eventResults";
import { photoToDataUri } from "./photo";
import type { FeedStoryAProps, FeedStoryBProps, FeedStoryCProps, ResultCardProps } from "./templates";

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
          event: { select: { name: true, photo: true, isOnline: true, location: true } },
        },
      },
      media: { orderBy: { order: "asc" }, take: 1, where: { kind: "PHOTO" } },
    },
  });
  if (!post) return null;

  if (post.linkedEventResult) {
    const r = post.linkedEventResult;
    const photoUrl = photoOverride ?? r.event.photo;
    const photo = await photoToDataUri(photoUrl);
    return {
      kind: "result",
      result: {
        name: post.user.name,
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
    a: { name: post.user.name, photo: postPhoto, score, label },
    b: { name: post.user.name, photo: avatar, quote: post.contentText ?? "" },
    c: {
      name: post.user.name,
      photo: avatar,
      date: formatDate(post.createdAt, { day: "numeric", month: "short" }),
      scoreLabel,
      score,
      badge,
      description: w?.description ?? null,
      stats,
    },
  };
}
