"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreIcon } from "@/components/MoreIcon";
import { ReportButton } from "@/components/ReportButton";
import type { ReportTargetTypeOption } from "@/lib/validation";

function MuteIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function BlockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
    </svg>
  );
}

function ReportIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

const ROW_CLASS = "flex w-full items-center gap-2.5 rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-b2b-bg disabled:opacity-50";

/**
 * The "..." that tucks Mute/Block/Report behind the same sliding bottom-sheet
 * already shipped for stories (see StoryViewer's moreOpen sheet), instead of
 * text links competing with other actions. Mute/Block always act on
 * `targetUserId` (the profile, or a post/notice's author); the Report
 * defaults to reporting that same user, but a caller showing this on a post
 * or notice passes `reportTargetType`/`reportTargetId` so the report is filed
 * against the content itself (e.g. targetType "POST"), not its author.
 */
export function ProfileMoreMenu({
  targetUserId,
  targetName,
  initialBlocked,
  initialMuted,
  reportTargetType = "USER",
  reportTargetId = targetUserId,
  // "overlay": a bare icon (no border/background) for sitting inside a
  // SwipeCardList cornerAction slot, which already supplies its own
  // backdrop circle — see Discover's carousel cards.
  variant = "default",
}: {
  targetUserId: string;
  targetName: string;
  initialBlocked: boolean;
  initialMuted: boolean;
  reportTargetType?: ReportTargetTypeOption;
  reportTargetId?: string;
  variant?: "default" | "overlay";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [muted, setMuted] = useState(initialMuted);
  const [busy, setBusy] = useState<"block" | "mute" | null>(null);
  // Portal the sheet straight to <body> — this trigger can sit inside a
  // transformed/overflow-hidden ancestor (a SwipeCardList carousel card),
  // which would otherwise clip a plain `fixed` overlay to that ancestor's
  // box instead of the viewport.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function toggleMute() {
    setBusy("mute");
    const res = await fetch(`/api/users/${targetUserId}/mute`, { method: muted ? "DELETE" : "POST" });
    setBusy(null);
    if (res.ok) {
      const body = await res.json();
      setMuted(body.muted);
      setOpen(false);
      router.refresh();
    }
  }

  async function toggleBlock() {
    setBusy("block");
    const res = await fetch(`/api/users/${targetUserId}/block`, { method: blocked ? "DELETE" : "POST" });
    setBusy(null);
    if (res.ok) {
      const body = await res.json();
      setBlocked(body.blocked);
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="More options"
        className={
          variant === "overlay"
            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-b2b-purple/15 text-b2b-ink/60 hover:bg-b2b-bg"
        }
      >
        <MoreIcon className={variant === "overlay" ? "h-3.5 w-3.5" : "h-[17px] w-[17px]"} />
      </button>

      {/* Mounted unconditionally — its own report dialog has to survive us
          closing this sheet when "Report" is tapped (see renderTrigger below). */}
      <ReportButton
        targetType={reportTargetType}
        targetId={reportTargetId}
        renderTrigger={(openReport) =>
          open &&
          mounted &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
              onClick={() => setOpen(false)}
            >
              <div className="w-full max-w-sm rounded-t-2xl bg-b2b-card p-2 shadow-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={toggleMute} disabled={busy !== null} className={`${ROW_CLASS} text-b2b-ink`}>
                  <MuteIcon />
                  {busy === "mute" ? "..." : muted ? `Unmute ${targetName}` : `Mute ${targetName}`}
                </button>
                <div className="border-t border-b2b-purple/10" />
                <button type="button" onClick={toggleBlock} disabled={busy !== null} className={`${ROW_CLASS} text-red-600`}>
                  <BlockIcon />
                  {busy === "block" ? "..." : blocked ? `Unblock ${targetName}` : `Block ${targetName}`}
                </button>
                <div className="border-t border-b2b-purple/10" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openReport();
                  }}
                  className={`${ROW_CLASS} text-red-600`}
                >
                  <ReportIcon />
                  Report
                </button>
                <div className="border-t border-b2b-purple/10" />
                <button type="button" onClick={() => setOpen(false)} className="w-full rounded-lg px-4 py-3 text-left text-sm text-b2b-ink/60 hover:bg-b2b-bg">
                  Cancel
                </button>
              </div>
            </div>,
            document.body
          )
        }
      />
    </>
  );
}
