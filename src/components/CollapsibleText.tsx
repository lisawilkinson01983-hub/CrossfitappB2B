"use client";

import { useEffect, useRef, useState } from "react";

/** Clamps text to 2 lines with a "Show more" toggle — the toggle only appears if the text actually overflows. */
export function CollapsibleText({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div>
      <p ref={ref} className={`whitespace-pre-wrap ${expanded ? "" : "line-clamp-2"} ${className}`}>
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-b2b-pink hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
