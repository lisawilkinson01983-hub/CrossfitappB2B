"use client";

import { useState, type FormEvent } from "react";
import { InfoDialog } from "@/components/InfoDialog";
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from "@/lib/labels";
import { REPORT_REASONS, type ReportReasonOption, type ReportTargetTypeOption } from "@/lib/validation";

/**
 * A "Report" link that opens a reason picker and files a report for an admin
 * to review at /reports/review. Rendered next to anything another user
 * wrote — never on your own content (the API rejects that anyway).
 */
export function ReportButton({
  targetType,
  targetId,
  className = "text-xs text-b2b-ink/50 hover:underline",
}: {
  targetType: ReportTargetTypeOption;
  targetId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReasonOption | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const label = REPORT_TARGET_LABELS[targetType];

  function close() {
    setOpen(false);
    setReason(null);
    setDetails("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, details: details.trim() || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    close();
    setDone(true);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-b2b-card p-5 text-left shadow-lg"
          >
            <p id="report-dialog-title" className="text-base font-semibold text-b2b-ink">
              Report this {label}
            </p>
            <p className="mt-1 text-sm text-b2b-ink/60">
              Your report is anonymous — the person won't be told who reported them.
            </p>

            <fieldset className="mt-4 flex flex-col gap-2">
              <legend className="sr-only">Reason</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-b2b-ink">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-b2b-pink"
                  />
                  {REPORT_REASON_LABELS[r]}
                </label>
              ))}
            </fieldset>

            <label htmlFor="report-details" className="mt-4 block text-sm font-medium text-b2b-ink">
              Anything else we should know? <span className="font-normal text-b2b-ink/40">(optional)</span>
            </label>
            <textarea
              id="report-details"
              rows={3}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="mt-1 w-full resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
            />

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="rounded px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!reason || submitting}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Report"}
              </button>
            </div>
          </form>
        </div>
      )}

      <InfoDialog
        open={done}
        title="Thanks for letting us know"
        message={`We'll review this ${label} and take action if it breaks our community guidelines. You can also block this person from their profile so they can't contact you.`}
        onClose={() => setDone(false)}
      />
    </>
  );
}
