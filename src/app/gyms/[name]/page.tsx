import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ExpandableHeroPhoto } from "@/components/ExpandableHeroPhoto";
import { VerifiedTick } from "@/components/ProfileDetails";
import { GymBookingButtons } from "@/components/GymBookingButtons";
import { FollowButton, type FollowStatus } from "@/components/FollowButton";
import { MessageButton } from "@/components/MessageButton";
import { ProfileMoreMenu } from "@/components/ProfileMoreMenu";
import { bookingMailto, findVerifiedGymOwner } from "@/lib/gymPages";
import { BackLink } from "@/components/BackLink";
import { EditIcon } from "@/components/EditIcon";

export default async function GymPage({ params }: { params: Promise<{ name: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { name } = await params;

  const [me, gym] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } }),
    prisma.gym.findUnique({
      where: { name: decodeURIComponent(name) },
      include: { claimedBy: { select: { id: true, photo: true } } },
    }),
  ]);
  if (!gym) notFound();

  // Only worth showing the buttons if there's somewhere for a booking to
  // actually go, and not to the affiliate viewing their own gym's page.
  const owner = gym.bookingEmail ? null : await findVerifiedGymOwner(gym.name);
  const canBook = (gym.bookingEmail != null || owner != null) && owner?.id !== session.user.id;
  const isOwnGym = gym.claimedBy?.id === session.user.id;

  // The affiliate's own profile is where Follow/Message/Mute/Block/Report
  // actually live (see /profile/[userId]) — fetched here too so this, the
  // main place people land on a claimed gym, mirrors that same card instead
  // of only offering a click-through to the profile.
  let followStatus: FollowStatus = "none";
  let followerCount = 0;
  let followingCount = 0;
  let isBlocked = false;
  let isMuted = false;
  if (gym.claimedBy) {
    const claimedById = gym.claimedBy.id;
    [followerCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: claimedById } }),
      prisma.follow.count({ where: { followerId: claimedById } }),
    ]);
    if (!isOwnGym) {
      const [existingFollow, pendingRequest, blockRow, muteRow] = await Promise.all([
        prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: session.user.id, followingId: claimedById } },
        }),
        prisma.followRequest.findUnique({
          where: { requesterId_targetId: { requesterId: session.user.id, targetId: claimedById } },
        }),
        prisma.block.findUnique({
          where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: claimedById } },
        }),
        prisma.mute.findUnique({
          where: { userId_mutedUserId: { userId: session.user.id, mutedUserId: claimedById } },
        }),
      ]);
      followStatus = existingFollow ? "following" : pendingRequest?.status === "PENDING" ? "pending" : "none";
      isBlocked = Boolean(blockRow);
      isMuted = Boolean(muteRow);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex items-center justify-between">
        <BackLink href="/discover?view=affiliates">Back to affiliates</BackLink>
        {me?.isAdmin && (
          <Link
            href={`/gyms/${encodeURIComponent(gym.name)}/edit`}
            aria-label="Edit affiliate"
            className="text-b2b-purple hover:text-b2b-purple-dark"
          >
            <EditIcon className="h-5 w-5" />
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <ExpandableHeroPhoto photo={gym.claimedBy?.photo ?? gym.photo} name={gym.name}>
          {isOwnGym && (
            <Link
              href={`/gyms/${encodeURIComponent(gym.name)}/edit`}
              aria-label="Edit affiliate"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
            >
              <EditIcon className="h-4 w-4" />
            </Link>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-6 pt-16">
            <p className="flex flex-wrap items-center gap-1.5 font-display text-2xl leading-tight text-white drop-shadow-sm">
              {gym.name}
              {gym.claimedBy && <VerifiedTick />}
            </p>
            {gym.address && <p className="mt-1 text-sm text-white/75">{gym.address}</p>}
          </div>
        </ExpandableHeroPhoto>

        <div className="overflow-hidden rounded-2xl border border-b2b-purple/10 bg-b2b-card shadow-sm shadow-b2b-purple/5">
          <div className="px-5 py-5">
            {gym.claimedBy && !isOwnGym && (
              <div className="flex items-center gap-2">
                <MessageButton targetUserId={gym.claimedBy.id} fullWidth />
                <FollowButton targetUserId={gym.claimedBy.id} initialStatus={followStatus} fullWidth />
                <ProfileMoreMenu
                  targetUserId={gym.claimedBy.id}
                  targetName={gym.name}
                  initialBlocked={isBlocked}
                  initialMuted={isMuted}
                />
              </div>
            )}

            <div className={`flex flex-wrap gap-2 ${gym.claimedBy && !isOwnGym ? "mt-4 border-t border-b2b-purple/10 pt-4" : ""}`}>
              <Link
                href={`/discover?gym=${encodeURIComponent(gym.name)}`}
                className="rounded-xl bg-b2b-pink px-4 py-2.5 text-sm font-semibold text-white hover:bg-b2b-pink-dark"
              >
                Browse athletes at {gym.name}
              </Link>

              {gym.claimedBy && (
                <Link
                  href={`/profile/${gym.claimedBy.id}`}
                  className="rounded-xl border border-b2b-purple/20 px-4 py-2.5 text-sm font-semibold text-b2b-ink hover:bg-b2b-bg"
                >
                  {isOwnGym ? "View your profile" : "View full profile"}
                </Link>
              )}

              {gym.website && (
                <a
                  href={gym.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-b2b-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-b2b-purple-dark"
                >
                  🌐 Visit website
                </a>
              )}

              {canBook &&
                (gym.bookingEmail ? (
                  <>
                    <a
                      href={bookingMailto(gym.bookingEmail, "Intro Session", gym.name)}
                      className="rounded-xl bg-b2b-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-b2b-purple-dark"
                    >
                      Book an Intro Session
                    </a>
                    <a
                      href={bookingMailto(gym.bookingEmail, "Drop-in", gym.name)}
                      className="rounded-xl bg-b2b-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-b2b-purple-dark"
                    >
                      Book a Drop-in
                    </a>
                  </>
                ) : (
                  <GymBookingButtons gymId={gym.id} />
                ))}
            </div>

            {gym.claimedBy && (
              <div className="mt-4 flex border-t border-b2b-purple/10 pt-4">
                <div className="flex-1 text-center">
                  <div className="font-display text-2xl leading-none text-b2b-ink">{followerCount}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-b2b-ink/45">Followers</div>
                </div>
                <div className="flex-1 border-l border-b2b-purple/10 text-center">
                  <div className="font-display text-2xl leading-none text-b2b-ink">{followingCount}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-b2b-ink/45">Following</div>
                </div>
              </div>
            )}

            {gym.description && (
              <p className="mt-4 whitespace-pre-wrap border-t border-b2b-purple/10 pt-4 text-b2b-ink/80">
                {gym.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
