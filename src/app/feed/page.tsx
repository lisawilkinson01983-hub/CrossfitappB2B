import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { PostCard } from "@/components/PostCard";
import { SectionCard } from "@/components/SectionCard";
import { SectionOnboarding } from "@/components/SectionOnboarding";
import { postCardInclude, toPostCardData } from "@/lib/posts";
import { PostComposer } from "./PostComposer";

export default async function FeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [currentUser, blocked, muted] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { hasSeenFeedTour: true, accountType: true } }),
    prisma.block.findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } }),
    prisma.mute.findMany({ where: { userId: session.user.id }, select: { mutedUserId: true } }),
  ]);
  const hiddenUserIds = [...blocked.map((b) => b.blockedId), ...muted.map((m) => m.mutedUserId)];

  const posts = await prisma.post.findMany({
    where: { userId: { notIn: hiddenUserIds }, sharedToFeed: true },
    orderBy: { createdAt: "desc" },
    include: postCardInclude,
  });

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

      {posts.length === 0 ? (
        <p className="mt-6 text-b2b-ink/50">
          No posts yet — be the first to share something, or share a workout from your log.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              currentUserId={session.user.id}
              post={toPostCardData(post, session.user.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
