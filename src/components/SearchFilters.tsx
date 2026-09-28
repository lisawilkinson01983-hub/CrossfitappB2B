import type { ReactNode } from "react";

/**
 * Collapses a search form's secondary filter fields behind a "Filters"
 * disclosure, so the search bar itself doesn't come with a wall of dropdowns
 * attached on every page load. Uses the native <details> element rather than
 * a client component — the browser handles the toggle, no JS needed — and
 * opens by default whenever a filter from the current URL is already active,
 * so applied filters are never hidden from the person who set them.
 */
export function SearchFilters({
  activeCount,
  defaultOpen,
  children,
}: {
  activeCount: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-b2b-purple [&::-webkit-details-marker]:hidden">
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-b2b-pink px-1.5 text-xs font-medium text-white">
            {activeCount}
          </span>
        )}
        <svg
          className="h-4 w-4 text-b2b-ink/40 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </details>
  );
}
