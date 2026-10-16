import Link from "next/link";
import type { ReactNode } from "react";

/** One row on the edit-profile hub — same shape as SettingsMenuLink, plus an icon chip (see EditProfileSplitOptions design review). */
export function ProfileEditMenuLink({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg px-4 py-3 transition hover:border-b2b-pink/40 hover:bg-b2b-pink/5"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-b2b-pink/10 text-b2b-pink">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-b2b-ink">{label}</p>
        <p className="mt-0.5 truncate text-sm text-b2b-ink/50">{description}</p>
      </div>
      <span className="shrink-0 text-b2b-ink/30">›</span>
    </Link>
  );
}
