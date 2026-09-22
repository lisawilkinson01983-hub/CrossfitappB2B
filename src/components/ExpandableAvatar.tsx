"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";

/** A profile-header Avatar that opens the photo full-screen on tap. */
export function ExpandableAvatar({
  photo,
  name,
  size,
  showSingleBadge,
}: {
  photo: string | null;
  name: string;
  size: number;
  showSingleBadge?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!photo) {
    return <Avatar photo={photo} name={name} size={size} showSingleBadge={showSingleBadge} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${name}'s photo`}
        className="cursor-pointer rounded-full"
      >
        <Avatar photo={photo} name={name} size={size} showSingleBadge={showSingleBadge} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
          >
            ×
          </button>
          <div className="relative h-[min(80vw,80vh)] w-[min(80vw,80vh)]">
            <Image src={photo} alt={`${name}'s photo`} fill sizes="80vw" className="object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
