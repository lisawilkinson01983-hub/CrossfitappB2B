"use client";

import { useState } from "react";

export function VerifyEmailBanner() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/account/resend-verification", { method: "POST" });
    if (res.ok) {
      setStatus("sent");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-b2b-purple/10 px-4 py-2 text-xs text-b2b-ink/70">
      <span>
        {status === "sent" ? "Verification email sent — check your inbox." : "Please verify your email address."}
      </span>
      {status !== "sent" && (
        <button
          type="button"
          onClick={resend}
          disabled={status === "sending"}
          className="shrink-0 font-medium text-b2b-purple hover:underline disabled:opacity-50"
        >
          {status === "sending" ? "Sending..." : "Resend email"}
        </button>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
