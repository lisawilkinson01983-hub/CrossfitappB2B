import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEED_PAGE_SIZE, postCardInclude, toPostCardData } from "@/lib/posts";

/** The next page of the main feed, for the "Load more" button — see FeedPostList. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cursor = new URL(req.url).searchParams.get("cursor");

  const [blocked, muted] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } }),
    prisma.mute.findMany({ where: { userId: session.user.id }, select: { mutedUserId: true } }),
  ]);
  const hiddenUserIds = [...blocked.map((b) => b.blockedId), ...muted.map((m) => m.mutedUserId)];

  const posts = await prisma.post.findMany({
    where: { userId: { notIn: hiddenUserIds }, sharedToFeed: true },
    orderBy: { createdAt: "desc" },
    take: FEED_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: postCardInclude,
  });

  const hasMore = posts.length > FEED_PAGE_SIZE;
  const page = posts.slice(0, FEED_PAGE_SIZE);

  return NextResponse.json({
    posts: page.map((p) => toPostCardData(p, session.user.id)),
    nextCursor: page.length > 0 ? page[page.length - 1].id : null,
    hasMore,
  });
}
