import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { PostCard } from "@/components/PostCard";
import { postCardInclude, toPostCardData } from "@/lib/posts";

// A generous cap rather than real pagination — plenty for how this app is
// used today, and simpler than building "load more" for a limit unlikely to
// be hit in practice.
const MAX_POSTS = 200;

export default async function UserPostsPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, isPrivate: true },
  });
  if (!user) notFound();

  // Same gate as the profile page itself: a private account's posts are only
  // visible once we're an accepted follower (or it's our own page).
  if (userId !== session.user.id && user.isPrivate) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
    });
    if (!follow) redirect(`/profile/${userId}`);
  }

  const posts = await prisma.post.findMany({
    where: { userId, sharedToFeed: true },
    orderBy: { createdAt: "desc" },
    take: MAX_POSTS,
    include: postCardInclude,
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/profile/${userId}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to profile
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{user.name}&rsquo;s posts</h1>

      <div className="mt-6 flex flex-col gap-4">
        {posts.length === 0 ? (
          <p className="text-b2b-ink/40">No posts yet.</p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} currentUserId={session.user.id} post={toPostCardData(post, session.user.id)} />
          ))
        )}
      </div>
    </main>
  );
}
