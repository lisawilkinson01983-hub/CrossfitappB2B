"use client";

import type { ReactNode } from "react";
import { MentionTextarea } from "@/components/MentionTextarea";
import { AttachmentMenu, type AttachmentMenuItem } from "@/components/AttachmentMenu";

/**
 * The full-size popout a comment/reply bar opens into — same centered-modal
 * shape as EditModal, but for WRITING a new comment/reply rather than
 * editing one. A one-line inline field squeezed between a "+" and a send
 * button leaves no real room to write or to see the attachment menu options;
 * this gives it a real multi-line box, the full attachment menu, and a clear
 * Post/Cancel pair. Used by every comment and reply composer — feed posts,
 * gallery/PB comments, event notices — so writing feels the same everywhere.
 */
export function ComposerModal({
  open,
  onClose,
  title,
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel = "Post",
  placeholder,
  error,
  attachmentItems,
  gifPicker,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel?: string;
  placeholder?: string;
  error?: string | null;
  attachmentItems: AttachmentMenuItem[];
  /** The caller's own GifPicker, rendered open/closed by its own state — kept outside this modal's concerns since the caller owns which GIF gets sent. */
  gifPicker?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-b2b-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <MentionTextarea
          rows={5}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-b2b-pink focus:outline-none"
        />

        <div className="flex items-center justify-between gap-3">
          <div className="relative">
            <AttachmentMenu items={attachmentItems} />
            {gifPicker}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !value.trim()}
              className="rounded-full bg-b2b-pink px-5 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              {submitting ? "Posting..." : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
