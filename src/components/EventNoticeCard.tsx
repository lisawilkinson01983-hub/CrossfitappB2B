"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function EventNoticeCard({
  notice,
  isOwn,
}: {
  notice: {
    id: string;
    text: string;
    createdAt: string | Date;
    author: { id: string; name: string; photo: string | null };
  };
  isOwn: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    const res = await fetch(`/api/event-notices/${notice.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/profile/${notice.author.id}`} className="flex items-center gap-2 hover:underline">
          <Avatar photo={notice.author.photo} name={notice.author.name} size={32} />
          <span className="text-sm font-medium">{notice.author.name}</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-b2b-ink/40">
            {new Date(notice.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          {isOwn && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label="Delete notice"
              className="text-b2b-ink/40 hover:text-red-600"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-b2b-ink/80">{notice.text}</p>

      <ConfirmDialog
        open={confirmOpen}
        message="This notice will be deleted for good."
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        confirming={deleting}
      />
    </div>
  );
}
