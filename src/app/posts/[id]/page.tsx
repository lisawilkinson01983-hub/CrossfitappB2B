import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { PostCard } from "@/components/PostCard";
import { postCardInclude, toPostCardData } from "@/lib/posts";

/**
 * A single post, standalone — the canonical link target for post/comment
 * notifications (see src/lib/notifications.ts). Works regardless of
 * Post.sharedToFeed, unlike /feed?post=, so a comment left via the gallery
 * popout on a photo that was never shared to the feed still has somewhere
 * for its notification to actually land.
 */
export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ comment?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: postId } = await params;
  const { comment: highlightCommentId } = await searchParams;

  const post = await prisma.post.findUnique({ where: { id: postId }, include: postCardInclude });
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/feed" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to feed
      </Link>

      <div className="mt-4">
        <PostCard
          post={toPostCardData(post, session.user.id)}
          currentUserId={session.user.id}
          highlightPostId={post.id}
          highlightCommentId={highlightCommentId}
        />
      </div>
    </main>
  );
}
