import Link from "next/link";
import { redirect } from "next/navigation";
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
import { IncomingFollowRequests } from "@/components/IncomingFollowRequests";
import { GymUpdateNudge } from "@/components/GymUpdateNudge";
import { EditIcon } from "@/components/EditIcon";
import { OTHER_GYM } from "@/lib/gyms";
import { isCompetitionEvent } from "@/lib/labels";
import type { Prisma } from "@prisma/client";

// How many entries a Posts/Workouts tab preview-loads before pointing to the
// full post-history page — plenty for a tab people only expect a scroll's
// worth of, not a paginated archive.
const TAB_PREVIEW_COUNT = 10;

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // See feed/page.tsx's matching timer — same diagnostic, same reason:
  // ruling the page's own data-fetching in/out as the remaining source of
  // reported lag now that images are confirmed small.
  const fetchStart = Date.now();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { account: { select: { email: true } } },
  });
  if (!user) redirect("/login");

  const now = new Date();
  // An event's "effective end" is endDate if it has one, otherwise date — so
  // a multi-day event stays listed until its last day, not just its start.
  const notPastFilter: Prisma.EventWhereInput["OR"] = [
    { endDate: null, date: { gte: now } },
    { endDate: { gte: now } },
  ];

  const [
    workoutCount,
    followerCount,
    followingCount,
    incomingRequests,
    participatingIn,
    interestedIn,
    posts,
    postsTotalCount,
    workoutPosts,
  ] = await Promise.all([
    prisma.workout.count({ where: { userId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.followRequest.findMany({
      where: { targetId: user.id, status: "PENDING" },
      include: { requester: { select: { id: true, name: true } } },
    }),
    prisma.event.findMany({
      where: { AND: [{ participants: { some: { userId: user.id } } }, { OR: notPastFilter }] },
      orderBy: { date: "asc" },
    }),
    prisma.event.findMany({
      where: { AND: [{ interests: { some: { userId: user.id } } }, { OR: notPastFilter }] },
      orderBy: { date: "asc" },
    }),
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
  ]);
  console.log(`/profile: data fetch took ${Date.now() - fetchStart}ms`);

  // A private non-competition event isn't a competition — split it out into
  // its own "Attending" section rather than "Competing in" (see the matching
  // split on the event page/participants page).
  const competingIn = participatingIn.filter((e) => !(e.isPrivate && !isCompetitionEvent(e)));
  const attending = participatingIn.filter((e) => e.isPrivate && !isCompetitionEvent(e));

  let suggestedGym: string | undefined;
  if (user.affiliateGym === OTHER_GYM && user.affiliateGymOther) {
    // SQLite string equality is case-sensitive, so compare in JS to catch a
    // gym someone typed with different casing than how it's actually listed.
    const approvedGyms = await prisma.gym.findMany({ where: { status: "APPROVED" }, select: { name: true } });
    const typed = user.affiliateGymOther.trim().toLowerCase();
    suggestedGym = approvedGyms.find((g) => g.name.toLowerCase() === typed)?.name;
  }

  const tabs: ProfileTab[] = [
    {
      key: "posts",
      label: "Posts",
      content:
        posts.length === 0 ? (
          <p className="text-b2b-ink/40">No posts yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PostCard key={post.id} currentUserId={user.id} post={toPostCardData(post, user.id)} />
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
      content: (
        <div className="flex flex-col gap-4">
          <Link href="/workouts/new" className="self-start text-sm text-b2b-pink underline">
            Log a workout
          </Link>
          {workoutPosts.length === 0 ? (
            <p className="text-b2b-ink/40">No workouts shared yet.</p>
          ) : (
            workoutPosts.map((post) => (
              <PostCard key={post.id} currentUserId={user.id} post={toPostCardData(post, user.id)} />
            ))
          )}
        </div>
      ),
    });
  }

  tabs.push({
    key: "comps",
    label: "Comps",
    content:
      competingIn.length === 0 && attending.length === 0 && interestedIn.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-b2b-ink/40">No events added yet.</p>
          <Link href="/discover?view=events" className="text-sm text-b2b-pink underline">
            Browse events
          </Link>
        </div>
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
          {attending.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-b2b-ink/40">Attending</p>
              <div className="flex flex-col gap-3">
                {attending.map((event) => (
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

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex flex-col gap-6">
        <ProfileDetails
          user={user}
          accountEmail={user.account?.email ?? ""}
          showEmail
          isOwner
          followerCount={followerCount}
          followingCount={followingCount}
          workoutCount={workoutCount}
          actions={
            <Link href="/profile/edit" aria-label="Edit profile" className="text-white hover:text-white/80">
              <EditIcon className="h-4 w-4" />
            </Link>
          }
          belowActions={suggestedGym && <GymUpdateNudge suggestedGym={suggestedGym} />}
        />

        <Gallery userId={user.id} canAdd />

        <SectionCard>
          <ProfileContentTabs tabs={tabs} />
        </SectionCard>

        {incomingRequests.length > 0 && (
          <SectionCard title="Follow requests">
            <IncomingFollowRequests
              requests={incomingRequests.map((r) => ({ id: r.id, requester: r.requester }))}
            />
          </SectionCard>
        )}
      </div>
    </main>
  );
}
