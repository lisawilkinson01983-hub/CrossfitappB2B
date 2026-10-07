"use client";

import { useEffect, useRef, useState } from "react";
import { CommentsPopout } from "@/components/CommentsPopout";

/** One PB value, tappable to open its comments in a popout (see CommentsPopout). */
export function PbTile({
  label,
  value,
  featured,
  profileUserId,
  field,
  autoOpen = false,
}: {
  label: string;
  value: number;
  featured: boolean;
  profileUserId: string;
  field: string;
  /** Set when arriving from a PB_COMMENT notification link (see /profile/[userId]/pbs?field=) to open straight to this PB's comments. */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const tileRef = useRef<HTMLButtonElement>(null);
  const url = `/api/users/${profileUserId}/pb-comments/${field}`;

  useEffect(() => {
    if (autoOpen) tileRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Only ever run for the initial page load this link landed on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        ref={tileRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-lg border px-3 py-2 text-left hover:bg-b2b-purple/5 ${
          autoOpen ? "border-b2b-pink bg-b2b-pink/5" : "border-b2b-purple/10 bg-b2b-bg"
        }`}
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
        patchUrlFor={(id) => `/api/pb-comments/${id}`}
        deleteUrlFor={(id) => `/api/pb-comments/${id}`}
        reportTargetType="PB_COMMENT"
      />
    </>
  );
}
