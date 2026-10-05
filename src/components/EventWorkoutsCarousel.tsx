"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpandableImage } from "@/components/ExpandableImage";

export type EventWorkoutPhotoData = { id: string; photo: string; userId: string };

/**
 * An event's "Workouts" carousel — things like the released competition
 * workouts. Deliberately separate from the Notice Board: this is the
 * event's own curated gallery, not a chat message. Rendered twice: read-only
 * on the event homepage (just the photos), and with add/remove controls on
 * the event's edit page, where the organizer actually manages it.
 */
export function EventWorkoutsCarousel({
  eventId,
  photos,
  currentUserId,
  canAdd = false,
  isOrganizerOrAdmin = false,
  readOnly = false,
}: {
  eventId: string;
  photos: EventWorkoutPhotoData[];
  currentUserId: string;
  canAdd?: boolean;
  isOrganizerOrAdmin?: boolean;
  /** The event homepage's display-only view — no add/remove controls, just the photos. Management lives on the event's edit page instead. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    // Uploaded one at a time (rather than batched) so a failure partway
    // through still keeps whatever succeeded before it.
    for (const file of files) {
      const formData = new FormData();
      formData.set("photo", file);
      const res = await fetch(`/api/events/${eventId}/workout-photos`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't add that photo. Please try again.");
        break;
      }
    }
    setUploading(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/event-workout-photos/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) router.refresh();
  }

  const addButton = !readOnly && canAdd && (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-b2b-bg disabled:opacity-50"
      >
        {uploading ? "Adding…" : "📷 Add photos"}
      </button>
    </>
  );

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-b2b-ink/40">Check back soon.</p>
        {addButton}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} onScroll={handleScroll} className="flex snap-x snap-mandatory overflow-x-auto rounded">
        {photos.map((item) => {
          const canDelete = !readOnly && (isOrganizerOrAdmin || item.userId === currentUserId);
          return (
            <div key={item.id} className="relative w-full shrink-0 snap-center">
              {/* object-contain, not -cover: a workout poster's text needs
                  to stay fully readable, so nothing should get cropped. */}
              <ExpandableImage
                src={item.photo}
                alt="Workout"
                className="max-h-96 w-full rounded bg-b2b-bg object-contain"
              />
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  aria-label="Remove photo"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {photos.map((item, i) => (
            <span
              key={item.id}
              className={`h-1.5 w-1.5 rounded-full ${i === activeIndex ? "bg-b2b-pink" : "bg-b2b-purple/20"}`}
            />
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {addButton && <div className="mt-3 flex justify-center">{addButton}</div>}
    </div>
  );
}
