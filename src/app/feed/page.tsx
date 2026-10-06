import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { SectionOnboarding } from "@/components/SectionOnboarding";
import { StatusBar } from "@/components/StatusBar";
import { FEED_PAGE_SIZE, postCardInclude, toPostCardData } from "@/lib/posts";
import { summarizeReactions } from "@/lib/reactions";
import { PostComposer } from "./PostComposer";
import { FeedPostList } from "./FeedPostList";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string; comment?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { post: highlightPostId, comment: highlightCommentId } = await searchParams;

  // Timing this to separate "the page's own data-fetching is slow" from "the
  // images are slow once the page has already rendered" — reported lag
  // persisted after confirming images are now small, so this rules in/out
  // the query itself as the remaining cause.
  const fetchStart = Date.now();

  const [currentUser, blocked, muted] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { hasSeenFeedTour: true, accountType: true, status: true },
    }),
    prisma.block.findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } }),
    prisma.mute.findMany({ where: { userId: session.user.id }, select: { mutedUserId: true } }),
  ]);
  const hiddenUserIds = [...blocked.map((b) => b.blockedId), ...muted.map((m) => m.mutedUserId)];

  const statusUsers = await prisma.user.findMany({
    where: { status: { not: null }, id: { notIn: [...hiddenUserIds, session.user.id] } },
    orderBy: { statusUpdatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      name: true,
      photo: true,
      status: true,
      statusReactionsReceived: { select: { emoji: true, reactorId: true } },
    },
  });
  const statusBarEntries = statusUsers.map((u) => ({
    id: u.id,
    name: u.name,
    photo: u.photo,
    status: u.status!,
    reactions: summarizeReactions(
      u.statusReactionsReceived.map((r) => ({ emoji: r.emoji, userId: r.reactorId })),
      session.user.id
    ),
  }));

  const posts = await prisma.post.findMany({
    where: { userId: { notIn: hiddenUserIds }, sharedToFeed: true },
    orderBy: { createdAt: "desc" },
    take: FEED_PAGE_SIZE + 1,
    include: postCardInclude,
  });
  console.log(`/feed: data fetch took ${Date.now() - fetchStart}ms (${posts.length} posts)`);
  const hasMore = posts.length > FEED_PAGE_SIZE;
  const page = posts.slice(0, FEED_PAGE_SIZE);

  let initialPosts = page.map((p) => toPostCardData(p, session.user.id));

  // A notification can point at a post older than the first page — make sure
  // it's still there to pop open, even though "Load more" hasn't reached it.
  if (highlightPostId && !initialPosts.some((p) => p.id === highlightPostId)) {
    const highlighted = await prisma.post.findFirst({
      where: { id: highlightPostId, userId: { notIn: hiddenUserIds }, sharedToFeed: true },
      include: postCardInclude,
    });
    if (highlighted) {
      initialPosts = [toPostCardData(highlighted, session.user.id), ...initialPosts];
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      {!currentUser?.hasSeenFeedTour && (
        <SectionOnboarding
          section="feed"
          cards={[
            {
              emoji: "🏠",
              title: "Feed",
              body: "See workouts, PBs, and updates from people you follow — and post your own.",
            },
          ]}
        />
      )}
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Feed</h1>

      <div className="mt-4">
        <StatusBar myStatus={currentUser?.status ?? null} others={statusBarEntries} />
      </div>

      <div className="mt-4">
        <SectionCard
          action={
            currentUser?.accountType === "ATHLETE" && (
              <Link
                href="/workouts/new"
                className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
              >
                Post workout
              </Link>
            )
          }
        >
          <PostComposer />
        </SectionCard>
      </div>

      {initialPosts.length === 0 ? (
        <p className="mt-6 text-b2b-ink/50">
          No posts yet — be the first to share something, or share a workout from your log.
        </p>
      ) : (
        <FeedPostList
          initialPosts={initialPosts}
          initialCursor={page.length > 0 ? page[page.length - 1].id : null}
          initialHasMore={hasMore}
          currentUserId={session.user.id}
          highlightPostId={highlightPostId}
          highlightCommentId={highlightCommentId}
        />
      )}
    </main>
  );
}
