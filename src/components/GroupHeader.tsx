"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { GroupIcon } from "@/components/GroupIcon";
import { AvatarCropper } from "@/components/AvatarCropper";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Member = { id: string; name: string; deletedAt: Date | string | null };

/**
 * A group conversation's header: photo (any participant may change it — see
 * PATCH /api/conversations/[id]), the member list with a per-member remove
 * action, and a "Leave group" button. Flat permissions throughout — there's
 * no group admin/owner concept, any current member can remove any other.
 */
export function GroupHeader({
  conversationId,
  displayName,
  initialPhoto,
  members,
  currentUserId,
}: {
  conversationId: string;
  displayName: string;
  initialPhoto: string | null;
  members: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState(initialPhoto);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const others = members.filter((m) => m.id !== currentUserId && !m.deletedAt);

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

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await fetch(`/api/conversations/${conversationId}/participants/${removeTarget.id}`, {
      method: "DELETE",
    });
    setRemoving(false);
    setRemoveTarget(null);
    if (res.ok) router.refresh();
  }

  async function confirmLeave() {
    setLeaving(true);
    const res = await fetch(`/api/conversations/${conversationId}/participants/${currentUserId}`, {
      method: "DELETE",
    });
    setLeaving(false);
    setLeaveConfirmOpen(false);
    if (res.ok) router.push("/messages");
  }

  return (
    <div>
      <div className="flex items-center gap-3">
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
          <p className="text-xs text-b2b-ink/50">{members.length} people</p>
        </div>
      </div>

      {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
      {uploadingPhoto && <p className="mt-1 text-xs text-b2b-ink/40">Updating group photo...</p>}

      {others.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {others.map((member) => (
            <span
              key={member.id}
              className="flex items-center gap-1 rounded-full bg-b2b-purple/10 py-1 pl-2.5 pr-1.5 text-xs text-b2b-purple"
            >
              {member.name}
              <button
                type="button"
                onClick={() => setRemoveTarget(member)}
                aria-label={`Remove ${member.name} from the group`}
                className="text-b2b-purple/60 hover:text-b2b-purple"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setLeaveConfirmOpen(true)}
        className="mt-2 text-xs text-red-600 hover:underline"
      >
        Leave group
      </button>

      {cropSource && <AvatarCropper imageSrc={cropSource} onCancel={handleCropCancel} onCropped={handleCropped} />}

      <ConfirmDialog
        open={removeTarget !== null}
        title={`Remove ${removeTarget?.name ?? "this person"}?`}
        message="They'll no longer see this conversation or receive new messages in it."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
        confirming={removing}
      />
      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Leave this group?"
        message="You'll stop seeing this conversation. The group continues for everyone else."
        confirmLabel="Leave"
        onConfirm={confirmLeave}
        onCancel={() => setLeaveConfirmOpen(false)}
        confirming={leaving}
      />
    </div>
  );
}
