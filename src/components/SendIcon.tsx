/** The dart/paper-plane used to submit a comment, reply, or message — replaces a text "Post"/"Comment"/"Send" button everywhere one is typed. */
export function SendIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 5h16l-8 15L4 5z" />
      <line x1="12" y1="5" x2="12" y2="20" />
    </svg>
  );
}
