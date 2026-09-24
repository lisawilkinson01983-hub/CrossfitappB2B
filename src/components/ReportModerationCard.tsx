"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from "@/lib/labels";
import type { ReportReasonOption, ReportTargetTypeOption } from "@/lib/validation";

export type ReportModerationData = {
  id: string;
  targetType: ReportTargetTypeOption;
  reason: ReportReasonOption;
  details: string | null;
  contentSnapshot: string | null;
  mediaSnapshot: string | null;
  href: string | null;
  createdAt: Date;
  reporter: { id: string; name: string };
  reportedUser: { id: string; name: string; email: string; suspendedAt: Date | null };
  // Other open reports on the same content, from other people.
  otherReportCount: number;
};

type Action = "dismiss" | "remove" | "suspend";

const CONFIRM_MESSAGES: Record<Exclude<Action, "dismiss">, string> = {
  remove: "This permanently deletes the reported content.",
  suspend:
    "This deletes the reported content (if any) and suspends the account, signing them out everywhere. Undo by clearing suspendedAt on the user in Prisma Studio.",
};

export function ReportModerationCard({ report }: { report: ReportModerationData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState<Exclude<Action, "dismiss"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isUserReport = report.targetType === "USER";
  const isVideo = report.mediaSnapshot?.endsWith(".mp4") || report.mediaSnapshot?.endsWith(".mov");

  async function resolve(action: Action) {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/reports/${report.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    setConfirming(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          {REPORT_REASON_LABELS[report.reason]}
        </span>
        <span className="text-xs text-b2b-ink/50">
          {REPORT_TARGET_LABELS[report.targetType]} by{" "}
          <Link href={`/profile/${report.reportedUser.id}`} className="font-medium text-b2b-ink underline">
            {report.reportedUser.name}
          </Link>{" "}
          ({report.reportedUser.email})
        </span>
        {report.reportedUser.suspendedAt && (
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Suspended</span>
        )}
      </div>

      {(report.contentSnapshot || report.mediaSnapshot) && (
        <div className="mt-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3 text-sm">
          {report.contentSnapshot && <p className="whitespace-pre-wrap text-b2b-ink/80">{report.contentSnapshot}</p>}
          {report.mediaSnapshot &&
            (isVideo ? (
              <video src={report.mediaSnapshot} controls className="mt-2 max-h-60 rounded" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={report.mediaSnapshot} alt="Reported media" className="mt-2 max-h-60 rounded object-contain" />
            ))}
        </div>
      )}

      {report.details && (
        <p className="mt-2 text-sm text-b2b-ink/70">
          <span className="font-medium">Reporter's note:</span> {report.details}
        </p>
      )}

      <p className="mt-2 text-xs text-b2b-ink/40">
        Reported by {report.reporter.name} · {report.createdAt.toLocaleString()}
        {report.otherReportCount > 0 &&
          ` · ${report.otherReportCount} other ${report.otherReportCount === 1 ? "report" : "reports"} on this`}
        {report.href && (
          <>
            {" · "}
            <Link href={report.href} className="text-b2b-pink underline">
              View in app
            </Link>
          </>
        )}
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => resolve("dismiss")}
          disabled={busy !== null}
          className="rounded border border-gray-300 px-4 py-1.5 text-sm font-medium text-b2b-ink/70 hover:bg-b2b-bg disabled:opacity-50"
        >
          {busy === "dismiss" ? "Dismissing..." : "Dismiss"}
        </button>
        {!isUserReport && (
          <button
            type="button"
            onClick={() => setConfirming("remove")}
            disabled={busy !== null}
            className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Remove {REPORT_TARGET_LABELS[report.targetType]}
          </button>
        )}
        {!report.reportedUser.suspendedAt && (
          <button
            type="button"
            onClick={() => setConfirming("suspend")}
            disabled={busy !== null}
            className="rounded bg-gray-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {isUserReport ? "Suspend account" : "Remove & suspend"}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        message={confirming ? CONFIRM_MESSAGES[confirming] : ""}
        confirmLabel={confirming === "suspend" ? "Suspend" : "Remove"}
        onConfirm={() => confirming && resolve(confirming)}
        onCancel={() => setConfirming(null)}
        confirming={busy !== null}
      />
    </div>
  );
}
