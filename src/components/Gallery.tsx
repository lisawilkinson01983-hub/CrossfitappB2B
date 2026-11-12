import Link from "next/link";
import { SectionCard } from "@/components/SectionCard";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { getGalleryItems } from "@/lib/gallery";

const GALLERY_PREVIEW_LIMIT = 6;

/** A limited, most-recent-first strip of a user's uploaded photos/videos, pulled from their posts and logged workouts. The "Gallery" title itself links to the full gallery — same destination "Add media"/"See all" do. */
export async function Gallery({ userId, canAdd = false }: { userId: string; canAdd?: boolean }) {
  const items = await getGalleryItems(userId, GALLERY_PREVIEW_LIMIT);
  const galleryHref = `/profile/${userId}/gallery`;

  return (
    <SectionCard
      title={
        <Link href={galleryHref} className="hover:underline">
          Gallery
        </Link>
      }
      action={
        canAdd ? (
          <Link href={`${galleryHref}?add=1`} className="text-sm text-b2b-pink underline">
            Add media
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
          No photos or videos yet — share one from the feed or log a workout with a photo.
        </p>
      ) : (
        <GalleryLightbox
          items={items.map(({ key, type, url, thumbnail, source }) => ({ key, type, url, thumbnail, source }))}
          canEdit={canAdd}
          layout="grid"
          columns={4}
          tight
        />
      )}
    </SectionCard>
  );
}
