"use client";

import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "@/components/MoreIcon";
import { ReportButton } from "@/components/ReportButton";
import type { ReportTargetTypeOption } from "@/lib/validation";

/**
 * The "..." that tucks a comment's Report behind a small dropdown instead of
 * a bare text link sitting next to Reply — same instinct as ProfileMoreMenu
 * on posts/notices/profiles, scaled down for a single-action comment row.
 */
export function CommentActionsMenu({
  targetType,
  targetId,
}: {
  targetType: ReportTargetTypeOption;
  targetId: string;
}) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        className="flex h-5 w-5 items-center justify-center text-b2b-ink/40 hover:text-b2b-ink/70"
      >
        <MoreIcon className="h-3.5 w-3.5" />
      </button>

      <ReportButton
        targetType={targetType}
        targetId={targetId}
        renderTrigger={(openReport) =>
          open && (
            <div className="absolute left-0 top-full z-20 mt-1 w-28 rounded-lg border border-b2b-purple/15 bg-b2b-card p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openReport();
                }}
                className="w-full rounded px-3 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-b2b-bg"
              >
                Report
              </button>
            </div>
          )
        }
      />
    </div>
  );
}
