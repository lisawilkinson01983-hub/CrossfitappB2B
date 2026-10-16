/** A bolt, for a walk-in/spontaneous "Drop-in" booking — paired with CalendarIcon's scheduled "Intro Session". */
export function DropInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />
    </svg>
  );
}
