import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { FollowButton, type FollowStatus } from "@/components/FollowButton";
import { MessageButton } from "@/components/MessageButton";
import { BlockMuteControls } from "@/components/BlockMuteControls";
import { Avatar } from "@/components/Avatar";
import { showsSingleBadge } from "@/lib/labels";

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  const { tab, q: qParam } = await searchParams;
  const activeTab = tab === "following" ? "following" : "followers";
  const q = typeof qParam === "string" ? qParam.trim() : "";

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) notFound();

  const nameFilter = q ? { name: { contains: q } } : {};

  const rows =
    activeTab === "followers"
      ? (
          await prisma.follow.findMany({
            where: { followingId: userId, follower: nameFilter },
            include: { follower: true },
            orderBy: { createdAt: "desc" },
          })
        ).map((f) => f.follower)
      : (
          await prisma.follow.findMany({
            where: { followerId: userId, following: nameFilter },
            include: { following: true },
            orderBy: { createdAt: "desc" },
          })
        ).map((f) => f.following);

  const rowIds = rows.map((r) => r.id);

  const [myFollows, myPendingRequests, myBlocks, myMutes] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: session.user.id, followingId: { in: rowIds } },
      select: { followingId: true },
    }),
    prisma.followRequest.findMany({
      where: { requesterId: session.user.id, targetId: { in: rowIds }, status: "PENDING" },
      select: { targetId: true },
    }),
    prisma.block.findMany({
      where: { blockerId: session.user.id, blockedId: { in: rowIds } },
      select: { blockedId: true },
    }),
    prisma.mute.findMany({
      where: { userId: session.user.id, mutedUserId: { in: rowIds } },
      select: { mutedUserId: true },
    }),
  ]);
  const myFollowingIds = new Set(myFollows.map((f) => f.followingId));
  const myPendingIds = new Set(myPendingRequests.map((r) => r.targetId));
  const myBlockedIds = new Set(myBlocks.map((b) => b.blockedId));
  const myMutedIds = new Set(myMutes.map((m) => m.mutedUserId));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <h1 className="mt-6 text-2xl font-bold">{user.name}'s connections</h1>

      <div className="mt-4 flex gap-4 border-b border-gray-200 text-sm font-medium">
        <Link
          href={`/profile/${userId}/connections?tab=followers`}
          className={`pb-2 ${activeTab === "followers" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-gray-500"}`}
        >
          Followers
        </Link>
        <Link
          href={`/profile/${userId}/connections?tab=following`}
          className={`pb-2 ${activeTab === "following" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-gray-500"}`}
        >
          Following
        </Link>
      </div>

      <form method="GET" className="mt-4 flex gap-2">
        <input type="hidden" name="tab" value={activeTab} />
        <input
          type="text"
          name="q"
          placeholder={`Search ${activeTab}`}
          defaultValue={q}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
        >
          Search
        </button>
      </form>
      {q && (
        <Link
          href={`/profile/${userId}/connections?tab=${activeTab}`}
          className="mt-2 inline-block text-xs text-b2b-ink/50 hover:underline"
        >
          Clear search
        </Link>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-gray-500">{q ? `No ${activeTab} match "${q}".` : "No one here yet."}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {rows.map((row) => {
            const isMe = row.id === session.user.id;
            const status: FollowStatus = myFollowingIds.has(row.id)
              ? "following"
              : myPendingIds.has(row.id)
                ? "pending"
                : "none";

            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-b2b-card p-3"
              >
                <Link
                  href={isMe ? "/profile" : `/profile/${row.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <Avatar photo={row.photo} name={row.name} size={36} showSingleBadge={showsSingleBadge(row)} />
                  <span className="truncate font-medium">{row.name}</span>
                </Link>
                {!isMe && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-1.5">
                      <MessageButton targetUserId={row.id} compact />
                      <FollowButton targetUserId={row.id} initialStatus={status} compact />
                    </div>
                    <BlockMuteControls
                      targetUserId={row.id}
                      initialBlocked={myBlockedIds.has(row.id)}
                      initialMuted={myMutedIds.has(row.id)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
