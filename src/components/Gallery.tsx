import Link from "next/link";
import { SectionCard } from "@/components/SectionCard";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { AddMediaButton } from "@/components/AddMediaButton";
import { getGalleryItems } from "@/lib/gallery";

const GALLERY_PREVIEW_LIMIT = 9;

/** A limited, most-recent-first strip of a user's uploaded photos/videos, pulled from their posts and logged workouts. */
export async function Gallery({ userId, canAdd = false }: { userId: string; canAdd?: boolean }) {
  const items = await getGalleryItems(userId, GALLERY_PREVIEW_LIMIT);

  return (
    <SectionCard
      title="Gallery"
      action={
        items.length > 0 && (
          <Link href={`/profile/${userId}/gallery`} className="text-sm text-b2b-pink underline">
            See all
          </Link>
        )
      }
    >
      {canAdd && <AddMediaButton />}
      {items.length === 0 ? (
        <p className="text-b2b-ink/40">
          No photos or videos yet — share one from the feed or log a workout with a photo.
        </p>
      ) : (
        <GalleryLightbox
          items={items.map(({ key, type, url, thumbnail, source }) => ({ key, type, url, thumbnail, source }))}
          canEdit={canAdd}
        />
      )}
    </SectionCard>
  );
}
