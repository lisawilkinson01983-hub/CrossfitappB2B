import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { BackLink } from "@/components/BackLink";
import { WallComposer } from "@/components/WallComposer";
import { WallPostCard } from "@/components/WallPostCard";
import { wallPostInclude, toWallPostCardData } from "@/lib/wallPosts";

// A generous cap rather than real pagination — same convention as the
// Posts "see all" page.
const MAX_WALL_POSTS = 200;

export default async function WallPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, isPrivate: true },
  });
  if (!user) notFound();

  // Same gate as the profile page itself: a private account's wall is only
  // visible once we're an accepted follower (or it's our own page).
  if (userId !== session.user.id && user.isPrivate) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
    });
    if (!follow) redirect(`/profile/${userId}`);
  }

  const wallPosts = await prisma.wallPost.findMany({
    where: { wallOwnerId: userId },
    orderBy: { createdAt: "desc" },
    take: MAX_WALL_POSTS,
    include: wallPostInclude,
  });

  const isOwnWall = userId === session.user.id;

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/profile/${userId}`} className="mt-6">Back to profile</BackLink>

      <h1 className="mt-2 text-2xl font-bold">{isOwnWall ? "Your wall" : `${user.name}’s wall`}</h1>

      <div className="mt-6 flex flex-col gap-4">
        <WallComposer wallOwnerId={user.id} wallOwnerName={user.name} isOwnWall={isOwnWall} />
        {wallPosts.length === 0 ? (
          <p className="text-b2b-ink/40">No wall posts yet.</p>
        ) : (
          wallPosts.map((post) => (
            <WallPostCard
              key={post.id}
              post={toWallPostCardData(post, session.user.id, userId)}
              isWallOwner={isOwnWall}
            />
          ))
        )}
      </div>
    </main>
  );
}
