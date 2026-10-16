/** A medal — used for the "Ability" row on the edit-profile hub (level, Open badge, competition stats). */
export function MedalIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <circle cx="12" cy="15" r="6" />
      <path d="M9 9.5 6 3M15 9.5l3-6.5M9 3h6" />
      <path d="M12 12.5v5" />
    </svg>
  );
}
