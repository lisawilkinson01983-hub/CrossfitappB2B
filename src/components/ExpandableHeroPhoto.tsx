"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";

const NO_PHOTO_PATTERN = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(184,132,42,0.18) 0px, rgba(184,132,42,0.18) 2px, transparent 2px, transparent 18px)",
};

/**
 * The profile page's full-bleed photo header — the same "big photo, tap to
 * view full-screen" interaction as ExpandableAvatar, just sized as a hero
 * banner instead of a small circle. `children` renders as a sibling on top
 * of the photo (back/edit icons, the bottom gradient scrim, the level
 * badge) so none of that fights the photo's own click target.
 */
export function ExpandableHeroPhoto({
  photo,
  name,
  children,
}: {
  photo: string | null;
  name: string;
  children?: ReactNode;
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

  return (
    <div className="relative -mx-4 h-[420px] overflow-hidden bg-b2b-ink sm:-mx-0 sm:rounded-t-2xl">
      {photo ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`View ${name}'s photo`}
          className="absolute inset-0 h-full w-full cursor-pointer"
        >
          <Image src={photo} alt={`${name}'s photo`} fill sizes="(min-width: 640px) 640px, 100vw" className="object-cover" priority />
        </button>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={NO_PHOTO_PATTERN}>
          <span className="font-display text-[160px] leading-none text-b2b-pink/70">{name.charAt(0).toUpperCase()}</span>
        </div>
      )}

      {children}

      {open && photo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6" onClick={() => setOpen(false)}>
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
    </div>
  );
}
