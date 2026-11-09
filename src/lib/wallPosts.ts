import type { Prisma } from "@prisma/client";
import { summarizeReactions, type ReactionSummary } from "@/lib/reactions";

export const wallPostInclude = {
  author: { select: { id: true, name: true, photo: true } },
  likes: { select: { userId: true } },
  reactions: { select: { emoji: true, userId: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      user: { select: { id: true, name: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  },
} satisfies Prisma.WallPostInclude;

export type WallPostWithRelations = Prisma.WallPostGetPayload<{ include: typeof wallPostInclude }>;

export type WallPostCommentData = {
  id: string;
  text: string;
  gifUrl: string | null;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  createdAt: Date;
  author: { id: string; name: string };
  parentId: string | null;
  isMine: boolean;
  canDelete: boolean;
  reactions: ReactionSummary[];
};

export type WallPostCardData = {
  id: string;
  text: string | null;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  gifUrl: string | null;
  createdAt: Date;
  author: { id: string; name: string; photo: string | null };
  likeCount: number;
  likedByMe: boolean;
  reactions: ReactionSummary[];
  canDelete: boolean;
  comments: WallPostCommentData[];
};

/** `viewerId` is whoever's looking at the wall; `wallOwnerId` is whose wall it is — both can delete anything on it, alongside each piece's own author. */
export function toWallPostCardData(post: WallPostWithRelations, viewerId: string, wallOwnerId: string): WallPostCardData {
  const canModerate = viewerId === wallOwnerId;
  return {
    id: post.id,
    text: post.text,
    photo: post.photo,
    video: post.video,
    videoThumbnail: post.videoThumbnail,
    gifUrl: post.gifUrl,
    createdAt: post.createdAt,
    author: post.author,
    likeCount: post.likes.length,
    likedByMe: post.likes.some((l) => l.userId === viewerId),
    reactions: summarizeReactions(post.reactions, viewerId),
    canDelete: canModerate || post.authorId === viewerId,
    comments: post.comments.map((c) => ({
      id: c.id,
      text: c.text,
      gifUrl: c.gifUrl,
      photo: c.photo,
      video: c.video,
      videoThumbnail: c.videoThumbnail,
      createdAt: c.createdAt,
      author: c.user,
      parentId: c.parentId,
      isMine: c.userId === viewerId,
      canDelete: canModerate || c.userId === viewerId,
      reactions: summarizeReactions(c.reactions, viewerId),
    })),
  };
}
