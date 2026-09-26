import type { Prisma } from "@prisma/client";
import { parseTeammateRequests } from "@/lib/labels";
import type { PostCardData } from "@/components/PostCard";

// Shared between the main feed and a profile's posts (preview + full
// history) so the query shape and PostCard mapping stay in one place.
export const postCardInclude = {
  user: {
    select: {
      id: true,
      name: true,
      photo: true,
      level: true,
      affiliateGym: true,
      isSingle: true,
      showSingleBadge: true,
    },
  },
  linkedWorkout: { select: { wodName: true, score: true, unit: true, intensity: true, description: true } },
  linkedEvent: { select: { id: true, name: true, date: true, endDate: true, isOnline: true, location: true } },
  likes: { select: { userId: true } },
  comments: {
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true } },
      likes: { select: { userId: true } },
    },
  },
} satisfies Prisma.PostInclude;

export type PostWithCardData = Prisma.PostGetPayload<{ include: typeof postCardInclude }>;

export function toPostCardData(post: PostWithCardData, currentUserId: string): PostCardData {
  return {
    id: post.id,
    type: post.type,
    contentText: post.contentText,
    teammateRequests: parseTeammateRequests(post.teammateRequests),
    photo: post.photo,
    video: post.video,
    videoThumbnail: post.videoThumbnail,
    createdAt: post.createdAt,
    isOwner: post.userId === currentUserId,
    author: post.user,
    linkedWorkout: post.linkedWorkout,
    linkedEvent: post.linkedEvent,
    likeCount: post.likes.length,
    likedByMe: post.likes.some((like) => like.userId === currentUserId),
    comments: post.comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      author: comment.user,
      parentId: comment.parentId,
      likeCount: comment.likes.length,
      likedByMe: comment.likes.some((like) => like.userId === currentUserId),
    })),
  };
}
