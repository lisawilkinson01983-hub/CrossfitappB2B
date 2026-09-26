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

  const whatsappText = `Join me on Box 2 Box! Use my invite link to get started: ${link}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

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

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:bg-[#1ebe57]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0 0 12.04 2Zm0 18.1h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.26-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.25 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.24-.64.81-.78.97-.14.16-.29.18-.54.06-.25-.13-1.04-.38-1.99-1.22-.73-.66-1.23-1.46-1.37-1.71-.14-.24-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.24.25-.4.08-.16.04-.3-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.47-.01-.16 0-.43.06-.66.3-.23.24-.86.85-.86 2.06 0 1.22.88 2.4 1 2.56.13.16 1.73 2.65 4.2 3.71.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.19.21-.58.21-1.08.15-1.19-.06-.1-.23-.16-.48-.28Z" />
        </svg>
        Share on WhatsApp
      </a>

      <p className="text-sm text-b2b-ink/50">
        {referralCount} {referralCount === 1 ? "person has" : "people have"} joined using your code.
      </p>
    </div>
  );
}
