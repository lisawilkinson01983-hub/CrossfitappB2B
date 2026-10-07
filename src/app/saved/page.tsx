import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { PostCard } from "@/components/PostCard";
import { postCardInclude, toPostCardData } from "@/lib/posts";

// Same generous cap as a profile's full post history — see
// /profile/[userId]/posts.
const MAX_POSTS = 200;

export default async function SavedPostsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Post has no direct "when did this user save it" column to order by, so
  // fetch the save order separately and sort the loaded posts to match —
  // most recently saved first.
  const saves = await prisma.savedPost.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_POSTS,
    select: { postId: true },
  });
  const order = new Map(saves.map((s, i) => [s.postId, i]));

  const posts = await prisma.post.findMany({
    where: { id: { in: saves.map((s) => s.postId) } },
    include: postCardInclude,
  });
  posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/profile" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to profile
      </Link>

      <h1 className="mt-2 text-2xl font-bold">Saved posts</h1>

      <div className="mt-6 flex flex-col gap-4">
        {posts.length === 0 ? (
          <p className="text-b2b-ink/40">Nothing saved yet — tap the bookmark on a post to save it here.</p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} currentUserId={session.user.id} post={toPostCardData(post, session.user.id)} />
          ))
        )}
      </div>
    </main>
  );
}
