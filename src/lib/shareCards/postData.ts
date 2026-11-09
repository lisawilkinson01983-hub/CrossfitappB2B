import { prisma } from "@/lib/prisma";
import { WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { photoToDataUri } from "./photo";
import type { FeedStoryAProps, FeedStoryBProps, FeedStoryCProps } from "./templates";

/**
 * Loads a post (with the same visibility rule as viewing it in the feed —
 * its own author, or anyone, since posts aren't otherwise access-controlled
 * here beyond block/mute, which the share action doesn't need to re-check)
 * and the current user's chosen photo override, then builds the props for
 * whichever Feed Story format was requested.
 */
export async function loadFeedStoryData(
  postId: string,
  userId: string,
  photoOverride: string | null
): Promise<{ a: FeedStoryAProps; b: FeedStoryBProps; c: FeedStoryCProps } | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      user: { select: { id: true, name: true, photo: true } },
      linkedWorkout: true,
      media: { orderBy: { order: "asc" }, take: 1, where: { kind: "PHOTO" } },
    },
  });
  if (!post) return null;

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
