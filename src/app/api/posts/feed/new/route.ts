import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEED_PAGE_SIZE, postCardInclude, toPostCardData } from "@/lib/posts";

/**
 * Polled from the feed (see FeedPostList) to drive the "New posts" banner —
 * everything shared to the feed since `since` (an ISO timestamp, normally
 * the createdAt of whatever's currently the newest post on screen), newest
 * first. Same visibility rule as the main feed query (sharedToFeed +
 * hiddenUserIds) — nothing new here, just a "what's changed" lens on it.
 * Capped at a page's worth so a very quiet feed that's been open for days
 * doesn't suddenly return hundreds of posts in one go.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const since = new URL(req.url).searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;
  if (!sinceDate || Number.isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: "Invalid or missing 'since' timestamp" }, { status: 400 });
  }

  const [blocked, muted] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } }),
    prisma.mute.findMany({ where: { userId: session.user.id }, select: { mutedUserId: true } }),
  ]);
  const hiddenUserIds = [...blocked.map((b) => b.blockedId), ...muted.map((m) => m.mutedUserId)];

  const posts = await prisma.post.findMany({
    where: { userId: { notIn: hiddenUserIds }, sharedToFeed: true, createdAt: { gt: sinceDate } },
    orderBy: { createdAt: "desc" },
    take: FEED_PAGE_SIZE,
    include: postCardInclude,
  });

  return NextResponse.json({ posts: posts.map((p) => toPostCardData(p, session.user.id)) });
}
