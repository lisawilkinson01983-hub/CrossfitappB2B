/** A loaded barbell — used for the "PBs" row on the edit-profile hub. */
export function BarbellIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M2 12h3M19 12h3" />
      <path d="M5 9v6M8 7v10" />
      <path d="M16 7v10M19 9v6" />
      <path d="M8 12h8" />
    </svg>
  );
}
