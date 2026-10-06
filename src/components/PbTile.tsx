"use client";

import { useState } from "react";
import { CommentsPopout } from "@/components/CommentsPopout";

/** One PB value, tappable to open its comments in a popout (see CommentsPopout). */
export function PbTile({
  label,
  value,
  featured,
  profileUserId,
  field,
}: {
  label: string;
  value: number;
  featured: boolean;
  profileUserId: string;
  field: string;
}) {
  const [open, setOpen] = useState(false);
  const url = `/api/users/${profileUserId}/pb-comments/${field}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3 py-2 text-left hover:bg-b2b-purple/5"
      >
        <p className="text-xs text-b2b-ink/50">
          {label}
          {featured && (
            <span className="ml-1 text-b2b-pink" title="Featured on profile">
              ★
            </span>
          )}
        </p>
        <p className="mt-0.5 text-lg font-semibold text-b2b-ink">{value}</p>
        <p className="mt-0.5 text-[10px] text-b2b-ink/40">💬 Comment</p>
      </button>

      <CommentsPopout
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        listUrl={url}
        postUrl={url}
        deleteUrlFor={(id) => `/api/pb-comments/${id}`}
      />
    </>
  );
}
