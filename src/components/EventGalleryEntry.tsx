import Link from "next/link";
import { SectionCard } from "@/components/SectionCard";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { getEventGalleryItems } from "@/lib/gallery";

const GALLERY_PREVIEW_LIMIT = 6;

/**
 * A limited, most-recent-first strip of an event's own photos — official
 * shots the organizer (or anyone attending) added, plus anyone else's post
 * that tagged this event — same "Gallery" preview-card shape as a profile's
 * own Gallery (see Gallery.tsx), just scoped to the event instead of a user.
 */
export async function EventGalleryEntry({ eventId, canAdd }: { eventId: string; canAdd: boolean }) {
  const items = await getEventGalleryItems(eventId);
  const preview = items.slice(0, GALLERY_PREVIEW_LIMIT);
  const galleryHref = `/events/${eventId}/gallery`;

  return (
    <SectionCard
      title={
        <Link href={galleryHref} className="hover:underline">
          📷 Event Gallery{items.length > 0 ? ` · ${items.length}` : ""}
        </Link>
      }
      action={
        canAdd ? (
          <Link href={`${galleryHref}?add=1`} className="text-sm text-b2b-pink underline">
            Add photos
          </Link>
        ) : (
          items.length > 0 && (
            <Link href={galleryHref} className="text-sm text-b2b-pink underline">
              See all
            </Link>
          )
        )
      }
    >
      {items.length === 0 ? (
        <p className="text-b2b-ink/40">
          No photos yet — {canAdd ? "add the first one, or they'll" : "they'll"} show up here whenever someone tags
          this event on a post with photos.
        </p>
      ) : (
        <GalleryLightbox items={preview} layout="grid" columns={4} tight />
      )}
    </SectionCard>
  );
}
