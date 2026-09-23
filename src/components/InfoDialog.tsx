"use client";

/** A single-button acknowledgement modal — for confirming an action succeeded. */
export function InfoDialog({
  open,
  title = "Done",
  message,
  closeLabel = "OK",
  onClose,
}: {
  open: boolean;
  title?: string;
  message: string;
  closeLabel?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-b2b-card p-5 shadow-lg"
      >
        <p className="text-base font-semibold text-b2b-ink">{title}</p>
        <p className="mt-1 text-sm text-b2b-ink/60">{message}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-b2b-pink px-4 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
