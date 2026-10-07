"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { formatDateTime } from "@/lib/dates";

type Viewer = { id: string; name: string; photo: string | null; viewedAt: string };

/** Author-only "who's viewed this story" sheet, opened from StoryViewer. */
export function StoryViewersList({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const [viewers, setViewers] = useState<Viewer[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stories/${storyId}/views`)
      .then((res) => (res.ok ? res.json() : { views: [] }))
      .then((body) => {
        if (!cancelled) setViewers(body.views);
      });
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-t-2xl bg-b2b-card p-4 shadow-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-b2b-ink">
            Viewers{viewers ? ` (${viewers.length})` : ""}
          </p>
          <button type="button" onClick={onClose} className="text-b2b-ink/40 hover:text-b2b-ink/70">
            ×
          </button>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto">
          {viewers === null ? (
            <p className="text-sm text-b2b-ink/40">Loading...</p>
          ) : viewers.length === 0 ? (
            <p className="text-sm text-b2b-ink/40">No one's seen this yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {viewers.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <Avatar photo={v.photo} name={v.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-b2b-ink">{v.name}</p>
                  </div>
                  <span className="shrink-0 text-xs text-b2b-ink/40">{formatDateTime(v.viewedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
