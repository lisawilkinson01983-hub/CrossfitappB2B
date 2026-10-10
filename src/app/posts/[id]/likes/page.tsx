import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { FollowButton, type FollowStatus } from "@/components/FollowButton";
import { showsSingleBadge } from "@/lib/labels";
import { BackLink } from "@/components/BackLink";

export default async function PostLikesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: postId } = await params;

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) notFound();

  const likes = await prisma.like.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    select: {
      user: { select: { id: true, name: true, photo: true, isSingle: true, showSingleBadge: true } },
    },
  });
  const likers = likes.map((l) => l.user);
  const likerIds = likers.map((u) => u.id);

  const [myFollows, myPendingRequests] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: session.user.id, followingId: { in: likerIds } },
      select: { followingId: true },
    }),
    prisma.followRequest.findMany({
      where: { requesterId: session.user.id, targetId: { in: likerIds }, status: "PENDING" },
      select: { targetId: true },
    }),
  ]);
  const myFollowingIds = new Set(myFollows.map((f) => f.followingId));
  const myPendingIds = new Set(myPendingRequests.map((r) => r.targetId));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/feed" className="mt-6">Back to feed</BackLink>

      <h1 className="mt-4 text-2xl font-bold">Liked by</h1>

      {likers.length === 0 ? (
        <p className="mt-6 text-gray-500">No one has liked this post yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {likers.map((user) => {
            const isMe = user.id === session.user.id;
            const status: FollowStatus = myFollowingIds.has(user.id)
              ? "following"
              : myPendingIds.has(user.id)
                ? "pending"
                : "none";

            return (
              <div
                key={user.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-b2b-card p-3"
              >
                <Link
                  href={isMe ? "/profile" : `/profile/${user.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <Avatar photo={user.photo} name={user.name} size={36} showSingleBadge={showsSingleBadge(user)} />
                  <span className="truncate font-medium">{user.name}</span>
                </Link>
                {!isMe && <FollowButton targetUserId={user.id} initialStatus={status} compact />}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
