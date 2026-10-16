import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ProfileDetails } from "@/components/ProfileDetails";
import { Gallery } from "@/components/Gallery";
import { SectionCard } from "@/components/SectionCard";
import { PostCard } from "@/components/PostCard";
import { postCardInclude, toPostCardData } from "@/lib/posts";
import { ProfileContentTabs, type ProfileTab } from "@/components/ProfileContentTabs";
import { ProfileEventRow } from "@/components/ProfileEventRow";
import { FollowButton, type FollowStatus } from "@/components/FollowButton";
import { MessageButton } from "@/components/MessageButton";
import { ProfileMoreMenu } from "@/components/ProfileMoreMenu";
import { ExpandableHeroPhoto } from "@/components/ExpandableHeroPhoto";
import { LOOKING_FOR_LABELS, parseLookingFor, showsSingleBadge } from "@/lib/labels";
import type { Prisma } from "@prisma/client";

// Same preview cap as the own-profile page's Posts/Workouts tabs.
const TAB_PREVIEW_COUNT = 10;

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  if (userId === session.user.id) redirect("/profile");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { account: { select: { email: true } } },
  });
  if (!user) notFound();

  const [
    followerCount,
    followingCount,
    existingFollow,
    pendingRequest,
    workoutCount,
    me,
    blockRow,
    muteRow,
  ] = await Promise.all([
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: user.id } },
    }),
    prisma.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId: session.user.id, targetId: user.id } },
    }),
    prisma.workout.count({ where: { userId: user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { lookingFor: true } }),
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: user.id } },
    }),
    prisma.mute.findUnique({
      where: { userId_mutedUserId: { userId: session.user.id, mutedUserId: user.id } },
    }),
  ]);

  const followStatus: FollowStatus = existingFollow
    ? "following"
    : pendingRequest?.status === "PENDING"
      ? "pending"
      : "none";

  const sharedLookingFor = parseLookingFor(me?.lookingFor ?? null).filter((tag) =>
    parseLookingFor(user.lookingFor).includes(tag)
  );

  // A private account only opens up once we're an accepted follower — a
  // pending request is not enough. Until then, only their picture and name
  // are shown, same as anywhere else in the app a locked profile appears.
  const isLockedOut = user.isPrivate && followStatus !== "following";

  let tabs: ProfileTab[] = [];
  if (!isLockedOut) {
    const now = new Date();
    const notPastFilter: Prisma.EventWhereInput["OR"] = [
      { endDate: null, date: { gte: now } },
      { endDate: { gte: now } },
    ];

    const [posts, postsTotalCount, workoutPosts, competingIn, interestedIn] = await Promise.all([
      prisma.post.findMany({
        where: { userId: user.id, sharedToFeed: true },
        orderBy: { createdAt: "desc" },
        take: TAB_PREVIEW_COUNT,
        include: postCardInclude,
      }),
      prisma.post.count({ where: { userId: user.id, sharedToFeed: true } }),
      prisma.post.findMany({
        where: { userId: user.id, sharedToFeed: true, type: "WORKOUT" },
        orderBy: { createdAt: "desc" },
        take: TAB_PREVIEW_COUNT,
        include: postCardInclude,
      }),
      // Only public events — a private one never leaks onto someone else's
      // profile just because they're in it (see assertEventVisible).
      prisma.event.findMany({
        where: { AND: [{ participants: { some: { userId: user.id } } }, { isPrivate: false }, { OR: notPastFilter }] },
        orderBy: { date: "asc" },
      }),
      prisma.event.findMany({
        where: { AND: [{ interests: { some: { userId: user.id } } }, { isPrivate: false }, { OR: notPastFilter }] },
        orderBy: { date: "asc" },
      }),
    ]);

    tabs = [
      {
        key: "posts",
        label: "Posts",
        content:
          posts.length === 0 ? (
            <p className="text-b2b-ink/40">No posts yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {posts.map((post) => (
                <PostCard key={post.id} currentUserId={session.user.id} post={toPostCardData(post, session.user.id)} />
              ))}
              {postsTotalCount > posts.length && (
                <Link href={`/profile/${user.id}/posts`} className="text-center text-sm text-b2b-pink underline">
                  See all posts ({postsTotalCount})
                </Link>
              )}
            </div>
          ),
      },
    ];

    if (user.accountType === "ATHLETE") {
      tabs.push({
        key: "workouts",
        label: "Workouts",
        content:
          workoutPosts.length === 0 ? (
            <p className="text-b2b-ink/40">No workouts shared yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {workoutPosts.map((post) => (
                <PostCard key={post.id} currentUserId={session.user.id} post={toPostCardData(post, session.user.id)} />
              ))}
            </div>
          ),
      });
    }

    tabs.push({
      key: "comps",
      label: "Comps",
      content:
        competingIn.length === 0 && interestedIn.length === 0 ? (
          <p className="text-b2b-ink/40">No events yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {competingIn.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-b2b-ink/40">Competing in</p>
                <div className="flex flex-col gap-3">
                  {competingIn.map((event) => (
                    <ProfileEventRow key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )}
            {interestedIn.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-b2b-ink/40">Interested in</p>
                <div className="flex flex-col gap-3">
                  {interestedIn.map((event) => (
                    <ProfileEventRow key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ),
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex flex-col gap-6">
        {isLockedOut ? (
          <div className="flex flex-col gap-4">
            <ExpandableHeroPhoto photo={user.photo} name={user.name}>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-6 pt-16">
                <p className="flex flex-wrap items-center gap-1.5 font-display text-2xl leading-tight text-white drop-shadow-sm">
                  {user.name}
                  {showsSingleBadge(user) && (
                    <span title="Single" className="text-base">
                      💚
                    </span>
                  )}
                  <span className="text-sm font-normal text-white/70">🔒 Private</span>
                </p>
              </div>
            </ExpandableHeroPhoto>

            <SectionCard>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <MessageButton targetUserId={user.id} fullWidth />
                  <FollowButton targetUserId={user.id} initialStatus={followStatus} fullWidth />
                  <ProfileMoreMenu
                    targetUserId={user.id}
                    targetName={user.name}
                    initialBlocked={Boolean(blockRow)}
                    initialMuted={Boolean(muteRow)}
                  />
                </div>

                <p className="border-t border-b2b-purple/10 pt-3 text-center text-sm text-b2b-ink/50">
                  This account is private. Follow {user.name} to see their profile, PBs and workouts.
                </p>
              </div>
            </SectionCard>
          </div>
        ) : (
          <>
            <ProfileDetails
              user={user}
              accountEmail={user.account?.email ?? ""}
              showEmail={false}
              followerCount={followerCount}
              followingCount={followingCount}
              workoutCount={workoutCount}
              actions={
                <>
                  <MessageButton targetUserId={user.id} fullWidth />
                  <FollowButton targetUserId={user.id} initialStatus={followStatus} fullWidth />
                  <ProfileMoreMenu
                    targetUserId={user.id}
                    targetName={user.name}
                    initialBlocked={Boolean(blockRow)}
                    initialMuted={Boolean(muteRow)}
                  />
                </>
              }
              belowActions={
                sharedLookingFor.length > 0 ? (
                  <p className="rounded-lg bg-b2b-pink/10 px-3 py-2 text-sm text-b2b-pink-dark">
                    You're both looking for {sharedLookingFor.map((tag) => LOOKING_FOR_LABELS[tag]).join(" & ")}
                  </p>
                ) : null
              }
            />

            <Gallery userId={user.id} />

            <SectionCard>
              <ProfileContentTabs tabs={tabs} />
            </SectionCard>
          </>
        )}
      </div>
    </main>
  );
}
