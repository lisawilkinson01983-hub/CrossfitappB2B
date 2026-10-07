"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { GroupIcon } from "@/components/GroupIcon";
import { AvatarCropper } from "@/components/AvatarCropper";

/**
 * A group conversation's header: photo (any participant may change it — see
 * PATCH /api/conversations/[id]) and a link to the dedicated members page
 * (see /messages/[conversationId]/members) — adding/removing people and
 * leaving all live there, deliberately apart from this header, rather than
 * an always-visible × next to a name that's one accidental tap from removing
 * someone.
 */
export function GroupHeader({
  conversationId,
  displayName,
  initialPhoto,
  memberCount,
}: {
  conversationId: string;
  displayName: string;
  initialPhoto: string | null;
  memberCount: number;
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState(initialPhoto);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) setCropSource(URL.createObjectURL(file));
    e.target.value = "";
  }

  function handleCropCancel() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

  async function handleCropped(blob: Blob) {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    setPhotoError(null);
    setUploadingPhoto(true);

    const formData = new FormData();
    formData.set("photo", new File([blob], "group.jpg", { type: "image/jpeg" }));
    const res = await fetch(`/api/conversations/${conversationId}`, { method: "PATCH", body: formData });
    setUploadingPhoto(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPhotoError(body.error ?? "Couldn't update the group photo. Please try again.");
      return;
    }
    const body = await res.json();
    setPhoto(body.photo);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            aria-label="Change group photo"
            className="relative shrink-0 rounded-full disabled:opacity-60"
          >
            {photo ? <Avatar photo={photo} name={displayName} size={40} /> : <GroupIcon size={40} />}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-b2b-pink text-[9px] text-white">
              📷
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{displayName}</h1>
            <p className="text-xs text-b2b-ink/50">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
        <Link
          href={`/messages/${conversationId}/members`}
          aria-label="Manage group members"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-b2b-ink/50 hover:bg-b2b-purple/5 hover:text-b2b-ink"
        >
          ⚙️
        </Link>
      </div>

      {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
      {uploadingPhoto && <p className="mt-1 text-xs text-b2b-ink/40">Updating group photo...</p>}

      {cropSource && <AvatarCropper imageSrc={cropSource} onCancel={handleCropCancel} onCropped={handleCropped} />}
    </div>
  );
}
