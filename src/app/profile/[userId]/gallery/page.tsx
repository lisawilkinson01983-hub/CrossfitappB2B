import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { AddMediaButton } from "@/components/AddMediaButton";
import { getGalleryItems } from "@/lib/gallery";
import { BackLink } from "@/components/BackLink";

export default async function UserGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ workout?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  const { workout: openWorkoutId } = await searchParams;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  // Same gate as the profile page itself: a private account's gallery is
  // only visible once we're an accepted follower (or it's our own page).
  if (userId !== session.user.id && user.isPrivate) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
    });
    if (!follow) redirect(`/profile/${userId}`);
  }

  const isOwner = userId === session.user.id;
  const items = await getGalleryItems(userId);
  // A WORKOUT_COMMENT notification deep-links here with ?workout= — open
  // straight to that photo/video's comments instead of just the grid.
  const openIndex = openWorkoutId
    ? items.findIndex((item) => item.source.kind === "workout" && item.source.workoutId === openWorkoutId)
    : -1;

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={isOwner ? "/profile" : `/profile/${userId}`} className="mt-6">Back to profile</BackLink>

      <h1 className="mt-2 text-2xl font-bold">{isOwner ? "Your" : `${user.name}'s`} gallery</h1>

      <div className="mt-6">
        {isOwner && <AddMediaButton />}
        {items.length === 0 ? (
          <p className="mt-4 text-b2b-ink/40">
            No photos or videos yet — share one from the feed or log a workout with a photo.
          </p>
        ) : (
          <div className="mt-4">
            <GalleryLightbox
              items={items.map(({ key, type, url, thumbnail, source }) => ({ key, type, url, thumbnail, source }))}
              canEdit={isOwner}
              layout="grid"
              autoOpenIndex={openIndex >= 0 ? openIndex : undefined}
              autoOpenComments={openIndex >= 0}
            />
          </div>
        )}
      </div>
    </main>
  );
}
