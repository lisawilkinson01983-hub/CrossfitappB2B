/** The speaker used to toggle a video story's sound — a slash through it when muted, same convention as Instagram/TikTok. */
export function MuteIcon({ muted, className = "h-5 w-5" }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 9v6h4l5 5V4L8 9H4z" />
      {!muted && <path d="M17 8a5 5 0 0 1 0 8" />}
      {!muted && <path d="M19.5 5.5a9 9 0 0 1 0 13" />}
      {muted && <path d="M16 9l5 5M21 9l-5 5" />}
    </svg>
  );
}
