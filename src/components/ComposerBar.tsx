"use client";

/**
 * The compact, always-visible row that opens a ComposerModal when tapped —
 * a decorative "+" and send accent either side of a placeholder pill, same
 * shape the inline composer used to be, but the whole row is just a trigger
 * now rather than a cramped one-line input.
 */
export function ComposerBar({
  placeholder,
  onClick,
}: {
  placeholder: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-full border border-gray-300 bg-b2b-bg px-1 py-1 pr-1 text-left hover:bg-b2b-bg/70"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 text-sm leading-none text-b2b-ink/50">
        +
      </span>
      <span className="flex-1 truncate text-sm text-b2b-ink/40">{placeholder}</span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-b2b-pink text-white">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19 19 5M19 5H9M19 5v10" />
        </svg>
      </span>
    </button>
  );
}
