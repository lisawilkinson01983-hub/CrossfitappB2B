"use client";

import { useEffect, useRef, useState } from "react";

export type AttachmentMenuItem = {
  key: string;
  label: string;
  onClick: () => void;
};

/**
 * A "+" button that reveals a small popup list of attachment options (GIF,
 * photo/video) — keeps a comment/message composer row from needing a
 * separate always-visible button per attachment type, which got cramped on
 * mobile. The caller supplies whichever options actually apply there.
 * Renders nothing if there's nothing to attach.
 */
export function AttachmentMenu({ items }: { items: AttachmentMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add attachment"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg leading-none text-b2b-ink/60 hover:bg-b2b-bg"
      >
        +
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex flex-col gap-0.5 whitespace-nowrap rounded-lg border border-b2b-purple/15 bg-white p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className="rounded px-3 py-1.5 text-left text-sm text-b2b-ink/70 hover:bg-b2b-bg"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
