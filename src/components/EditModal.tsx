"use client";

import { useState } from "react";
import { MentionTextarea } from "@/components/MentionTextarea";

/**
 * A centered modal for editing a comment/post/notice/message's text — same
 * shape as the app's other composer modals (see EventChatComposerModal).
 * Used instead of swapping a comment's own row for an inline textarea +
 * Save/Cancel, which breaks down badly on a phone once the text wraps to
 * more than one line (the buttons don't scale with the row, so they end up
 * oversized relative to a squeezed textarea).
 */
export function EditModal({
  title = "Edit",
  initialValue,
  placeholder,
  saving,
  error,
  onSave,
  onClose,
}: {
  title?: string;
  initialValue: string;
  placeholder?: string;
  saving: boolean;
  error?: string | null;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-b2b-purple/10 pb-3">
          <p className="font-semibold text-b2b-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl text-b2b-ink/40 hover:text-b2b-ink/70"
          >
            ×
          </button>
        </div>

        <div className="mt-3">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <MentionTextarea
            rows={4}
            value={value}
            onChange={setValue}
            placeholder={placeholder}
            autoFocus
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(value)}
              disabled={saving || !value.trim()}
              className="rounded-full bg-b2b-pink px-5 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
