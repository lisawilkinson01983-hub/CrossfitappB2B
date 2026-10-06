"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { GroupIcon } from "@/components/GroupIcon";

const REVEAL_WIDTH = 84;

export type ConversationRowData = {
  id: string;
  isGroup: boolean;
  displayName: string;
  photo: string | null;
  showSingleBadge: boolean;
  lastMessagePreview: string;
  dateLabel: string;
  unreadCount: number;
};

/**
 * One inbox row, swipeable left (via pointer events, so it works with a
 * mouse too, not just touch) to reveal a Remove action — hides the
 * conversation from this viewer's own inbox (see DELETE
 * /api/conversations/[id]), without affecting anyone else or deleting any
 * messages. A genuine drag suppresses the row's normal tap-to-open.
 */
export function ConversationRow({ row }: { row: ConversationRowData }) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);
  const drag = useRef<{ startX: number; startOffset: number; moved: boolean } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { startX: e.clientX, startOffset: offset, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    setOffset(Math.min(0, Math.max(-REVEAL_WIDTH, drag.current.startOffset + dx)));
  }

  function onPointerUp() {
    if (!drag.current) return;
    setDragging(false);
    setOffset((prev) => (prev <= -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0));
  }

  function handleOpen() {
    if (drag.current?.moved) {
      drag.current.moved = false;
      return;
    }
    if (offset !== 0) {
      setOffset(0);
      return;
    }
    router.push(`/messages/${row.id}`);
  }

  async function handleRemove() {
    setRemoving(true);
    const res = await fetch(`/api/conversations/${row.id}`, { method: "DELETE" });
    setRemoving(false);
    // No router.refresh() here: the server already excludes this row from
    // future renders, and refreshing immediately after risks a request that
    // started before this DELETE finished landing back with this row still
    // present, which would re-render a fresh instance (removed: false) and
    // overwrite the optimistic hide right after it happens.
    if (res.ok) setRemoved(true);
  }

  if (removed) return null;

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          style={{ width: REVEAL_WIDTH }}
          className="flex items-center justify-center bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {removing ? "..." : "Remove"}
        </button>
      </div>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(`/messages/${row.id}`);
        }}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? "none" : "transform 150ms ease-out" }}
        className="relative flex cursor-pointer touch-pan-y items-center gap-3 border border-b2b-purple/10 bg-b2b-card p-3"
      >
        {row.isGroup ? (
          row.photo ? (
            <Avatar photo={row.photo} name={row.displayName} size={48} />
          ) : (
            <GroupIcon size={48} />
          )
        ) : (
          <Avatar photo={row.photo} name={row.displayName} size={48} showSingleBadge={row.showSingleBadge} />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{row.displayName}</p>
          <p className="truncate text-sm text-b2b-ink/50">{row.lastMessagePreview}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-xs text-b2b-ink/40">{row.dateLabel}</span>
          {row.unreadCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-b2b-pink px-1.5 text-xs font-medium text-white">
              {row.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
