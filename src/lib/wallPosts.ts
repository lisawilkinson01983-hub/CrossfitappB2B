import type { Prisma } from "@prisma/client";

export const wallPostInclude = {
  author: { select: { id: true, name: true, photo: true } },
  likes: { select: { userId: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { id: true, name: true } } },
  },
} satisfies Prisma.WallPostInclude;

export type WallPostWithRelations = Prisma.WallPostGetPayload<{ include: typeof wallPostInclude }>;

export type WallPostCardData = {
  id: string;
  text: string | null;
  photo: string | null;
  createdAt: Date;
  author: { id: string; name: string; photo: string | null };
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  comments: {
    id: string;
    text: string;
    createdAt: Date;
    author: { id: string; name: string };
    canDelete: boolean;
  }[];
};

/** `viewerId` is whoever's looking at the wall; `wallOwnerId` is whose wall it is — both can delete anything on it, alongside each piece's own author. */
export function toWallPostCardData(post: WallPostWithRelations, viewerId: string, wallOwnerId: string): WallPostCardData {
  const canModerate = viewerId === wallOwnerId;
  return {
    id: post.id,
    text: post.text,
    photo: post.photo,
    createdAt: post.createdAt,
    author: post.author,
    likeCount: post.likes.length,
    likedByMe: post.likes.some((l) => l.userId === viewerId),
    canDelete: canModerate || post.authorId === viewerId,
    comments: post.comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt,
      author: c.user,
      canDelete: canModerate || c.userId === viewerId,
    })),
  };
}
