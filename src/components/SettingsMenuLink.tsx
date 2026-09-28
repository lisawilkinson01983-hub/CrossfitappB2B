import Link from "next/link";

/** One row on the Settings menu, linking out to that section's own page. */
export function SettingsMenuLink({
  href,
  label,
  description,
  count,
}: {
  href: string;
  label: string;
  description?: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg px-4 py-3 transition hover:border-b2b-pink/40 hover:bg-b2b-pink/5"
    >
      <div className="min-w-0">
        <p className="font-medium text-b2b-ink">{label}</p>
        {description && <p className="mt-0.5 truncate text-sm text-b2b-ink/50">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!!count && (
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-b2b-pink px-1.5 text-xs font-medium text-white">
            {count}
          </span>
        )}
        <span className="text-b2b-ink/30">›</span>
      </div>
    </Link>
  );
}
