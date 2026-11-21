import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { AddEventGalleryPhotos } from "@/components/AddEventGalleryPhotos";
import { getEventGalleryItems } from "@/lib/gallery";
import { assertEventVisible } from "@/lib/eventVisibility";

export default async function EventGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { add: autoOpenAdd } = await searchParams;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      createdById: true,
      submittedById: true,
      claimedById: true,
      isPrivate: true,
      status: true,
      participants: { where: { userId: session.user.id }, select: { id: true } },
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  // Same organizer-level bar as Message Attendees/Invite on the event page
  // itself (not the stricter canEditEvent, which also requires an approved
  // claim) — plus anyone already attending, per how this was scoped.
  const isOrganizer = event.createdById === session.user.id || event.submittedById === session.user.id;
  const canAdd = isOrganizer || event.claimedById === session.user.id || event.participants.length > 0;

  const rawItems = await getEventGalleryItems(event.id);
  // Computed here, not as a function handed to the Client Component below —
  // a closure built on the server can't cross that boundary as a prop (see
  // MediaItem.canEdit).
  const items = rawItems.map((item) => ({ ...item, canEdit: item.author.id === session.user.id }));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar title={`${event.name} Gallery`} back={{ href: `/events/${event.id}`, label: "Back to event" }} />

      {canAdd && (
        <div className="mt-4">
          <AddEventGalleryPhotos eventId={event.id} autoOpen={!!autoOpenAdd} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-4 text-b2b-ink/40">
          No photos yet — {canAdd ? "add the first one above, or they'll" : "they'll"} show up here whenever someone
          tags this event on a post with photos.
        </p>
      ) : (
        // Edge-to-edge like a Facebook/Instagram photo grid — bleeds past the
        // page's own side padding rather than sitting inset inside it.
        <div className="-mx-4 mt-4">
          <GalleryLightbox items={items} layout="grid" columns={3} tight />
        </div>
      )}
    </main>
  );
}
