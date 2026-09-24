"use client";

import { useEffect, useState } from "react";

export function InviteCodeCard({ code, referralCount }: { code: string; referralCount: number }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  // Starts as a relative path (matches server-rendered HTML) and fills in the
  // real origin after mount, avoiding a hydration mismatch.
  // Points at the install instructions (which show the code), since new
  // testers should add the app to their home screen before signing up.
  const [link, setLink] = useState(`/install?ref=${code}`);
  useEffect(() => setLink(`${window.location.origin}/install?ref=${code}`), [code]);

  async function copy(value: string, which: "code" | "link") {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-b2b-ink/60">
        Share your code or link — when someone signs up with it, it counts toward your invites.
      </p>

      <div className="flex items-center gap-2">
        <span className="flex-1 rounded border border-b2b-purple/15 bg-b2b-bg px-3 py-2 text-center font-mono text-lg tracking-widest">
          {code}
        </span>
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="shrink-0 rounded bg-b2b-purple px-3 py-2 text-sm font-medium text-white hover:bg-b2b-purple-dark"
        >
          {copied === "code" ? "Copied!" : "Copy code"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="flex-1 truncate rounded border border-b2b-purple/15 bg-b2b-bg px-3 py-2 text-sm text-b2b-ink/60">
          {link}
        </span>
        <button
          type="button"
          onClick={() => copy(link, "link")}
          className="shrink-0 rounded bg-b2b-pink px-3 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
        >
          {copied === "link" ? "Copied!" : "Copy link"}
        </button>
      </div>

      <p className="text-sm text-b2b-ink/50">
        {referralCount} {referralCount === 1 ? "person has" : "people have"} joined using your code.
      </p>
    </div>
  );
}
