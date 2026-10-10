import type { Prisma } from "@prisma/client";
import { parseTeammateRequests, parseLevels } from "@/lib/labels";
import { summarizeReactions } from "@/lib/reactions";
import type { PostCardData } from "@/components/PostCard";

// How many posts the feed loads at a time — both the initial server render
// and each "Load more" page (see /api/posts/feed).
export const FEED_PAGE_SIZE = 20;

// The fields that describe a post's actual content — shared between the main
// feed and a profile's posts (preview + full history), and nested one level
// into `sharedFrom` below so a shared post's card can render its original's
// content without a second round-trip.
const postContentInclude = {
  user: {
    select: {
      id: true,
      name: true,
      photo: true,
      levels: true,
      affiliateGym: true,
      isSingle: true,
      showSingleBadge: true,
      allowPostShares: true,
      accountType: true,
      verifiedAt: true,
    },
  },
  linkedWorkout: { select: { wodName: true, score: true, unit: true, intensity: true, description: true } },
  linkedEvent: { select: { id: true, name: true, date: true, endDate: true, isOnline: true, location: true } },
  media: {
    orderBy: { order: "asc" },
    select: { id: true, kind: true, url: true, thumbnail: true },
  },
  likes: { select: { userId: true } },
  savedBy: { select: { userId: true } },
  comments: {
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true } },
      likes: { select: { userId: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  },
  // Who has shared this post — see Post.sharedFromId. Only ever populated on
  // a true original (see the dereferencing in /api/posts/[id]/share), so
  // this list is the single source of truth for a post's share count.
  shares: { select: { userId: true } },
} satisfies Prisma.PostInclude;

export const postCardInclude = {
  ...postContentInclude,
  sharedFrom: { include: postContentInclude },
} satisfies Prisma.PostInclude;

export type PostWithCardData = Prisma.PostGetPayload<{ include: typeof postCardInclude }>;
type PostContentData = Prisma.PostGetPayload<{ include: typeof postContentInclude }>;

function isVerifiedAffiliate(user: { accountType: string; verifiedAt: Date | null }): boolean {
  return user.accountType === "AFFILIATE" && user.verifiedAt != null;
}

export function toPostCardData(post: PostWithCardData, currentUserId: string): PostCardData {
  // A share row carries none of its own content — the original (sharedFrom)
  // is what actually renders, including its own likes/comments/share count,
  // so engagement always reflects the one original post regardless of how
  // many times (or by whom) it's been reshared into view.
  const original: PostContentData = post.sharedFrom ?? post;

  return {
    id: original.id,
    feedItemId: post.id,
    sharedBy: post.sharedFrom
      ? {
          id: post.user.id,
          name: post.user.name,
          photo: post.user.photo,
          levels: parseLevels(post.user.levels),
          affiliateGym: post.user.affiliateGym,
          isSingle: post.user.isSingle,
          showSingleBadge: post.user.showSingleBadge,
          verified: isVerifiedAffiliate(post.user),
          sharedAt: post.createdAt,
          message: post.contentText,
        }
      : null,
    type: original.type,
    contentText: original.contentText,
    teammateRequests: parseTeammateRequests(original.teammateRequests),
    photo: original.photo,
    video: original.video,
    videoThumbnail: original.videoThumbnail,
    gifUrl: original.gifUrl,
    media: original.media,
    createdAt: original.createdAt,
    isOwner: original.userId === currentUserId,
    author: {
      id: original.user.id,
      name: original.user.name,
      photo: original.user.photo,
      levels: parseLevels(original.user.levels),
      affiliateGym: original.user.affiliateGym,
      isSingle: original.user.isSingle,
      showSingleBadge: original.user.showSingleBadge,
      verified: isVerifiedAffiliate(original.user),
    },
    linkedWorkout: original.linkedWorkout,
    linkedEvent: original.linkedEvent,
    likeCount: original.likes.length,
    likedByMe: original.likes.some((like) => like.userId === currentUserId),
    savedByMe: original.savedBy.some((save) => save.userId === currentUserId),
    comments: original.comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      gifUrl: comment.gifUrl,
      createdAt: comment.createdAt,
      author: comment.user,
      parentId: comment.parentId,
      likeCount: comment.likes.length,
      likedByMe: comment.likes.some((like) => like.userId === currentUserId),
      reactions: summarizeReactions(comment.reactions, currentUserId),
    })),
    shareCount: original.shares.length,
    sharedByMe: original.shares.some((share) => share.userId === currentUserId),
    canShare: original.user.allowPostShares,
  };
}
