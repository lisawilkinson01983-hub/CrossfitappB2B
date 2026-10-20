"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { Avatar } from "@/components/Avatar";

/** Writes a new message directly onto a profile's Wall tab — text and/or one photo. */
export function WallComposer({
  wallOwnerId,
  wallOwnerName,
  isOwnWall,
  currentUserName,
  currentUserPhoto,
}: {
  wallOwnerId: string;
  wallOwnerName: string;
  isOwnWall: boolean;
  currentUserName: string;
  currentUserPhoto: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
      return;
    }
    setError(null);
    setPhoto(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() && !photo) {
      setError("Write something, or add a photo");
      return;
    }

    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set("text", text);
    if (photo) formData.set("photo", photo);

    const res = await fetch(`/api/profile/${wallOwnerId}/wall`, { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    setText("");
    setPhoto(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
      <div className="flex items-start gap-3">
        <Avatar photo={currentUserPhoto} name={currentUserName} size={36} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isOwnWall ? "Write something on your wall..." : `Write on ${wallOwnerName}'s wall...`}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
        />
      </div>

      {photo && (
        <div className="relative mt-2 ml-11 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a servable path yet */}
          <img src={URL.createObjectURL(photo)} alt="" className="max-h-40 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => setPhoto(null)}
            aria-label="Remove photo"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-b2b-ink/70 text-sm text-b2b-bg hover:bg-b2b-ink"
          >
            ×
          </button>
        </div>
      )}

      {error && <p className="ml-11 mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-2 ml-11 flex items-center justify-between">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-b2b-ink/60 hover:bg-b2b-bg"
        >
          📷 Photo
        </button>
        <button
          type="submit"
          disabled={submitting || (!text.trim() && !photo)}
          className="rounded-full bg-b2b-pink px-4 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
