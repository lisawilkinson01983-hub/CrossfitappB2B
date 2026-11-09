"use client";

import type { PbField } from "@/lib/validation";
import { PB_LABELS } from "@/lib/labels";

export type NewPb = { field: PbField; value: number; previous: number | null };

/**
 * The "New PB logged" celebration modal — shared by PbEditor (quick PB
 * editor save) and SingleScoreForm (the workout logger's single-score
 * path), both of which can produce a genuine new PB and want the same
 * trophy/share prompt rather than two drifting copies of this markup.
 */
export function NewPbCelebration({
  newPb,
  onShare,
  onDismiss,
}: {
  newPb: NewPb;
  onShare: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onDismiss}>
      <div
        className="flex w-full max-w-xs flex-col items-center gap-1 rounded-2xl bg-b2b-card p-6 text-center shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-b2b-pink/10 text-2xl">
          🏆
        </span>
        <p className="text-xs font-bold uppercase tracking-wide text-b2b-pink">New PB logged</p>
        <p className="font-display text-sm uppercase">{PB_LABELS[newPb.field]}</p>
        <p className="font-display text-4xl leading-none text-b2b-ink">{newPb.value}kg</p>
        {newPb.previous != null && (
          <p className="mt-1 text-xs font-semibold text-b2b-pink">
            ▲ +{(newPb.value - newPb.previous).toFixed(1).replace(/\.0$/, "")}kg from your last PB
          </p>
        )}
        <button
          type="button"
          onClick={onShare}
          className="mt-4 w-full rounded-full bg-b2b-ink px-4 py-2.5 text-sm font-semibold text-b2b-bg"
        >
          🎉 Share your PB
        </button>
        <button type="button" onClick={onDismiss} className="mt-2 text-xs font-medium text-b2b-ink/40 hover:underline">
          Not now
        </button>
      </div>
    </div>
  );
}
