/** The pencil-in-a-bracket used in place of an "Edit" text link wherever one exists. */
export function EditIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
      <path d="M9 15l1-3.5L17.5 4l3 3L13 14.5 9 15z" />
    </svg>
  );
}
