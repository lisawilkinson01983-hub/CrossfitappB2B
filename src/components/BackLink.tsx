import Link from "next/link";
import { BackIcon } from "@/components/BackIcon";

/**
 * A "go back/up" link — just the arrow icon, no visible "Back to X" label
 * cluttering the top of every screen. `children` (what every call site
 * already passes, e.g. "Back to feed") becomes the icon's accessible name
 * instead of being printed out, so screen readers still announce where it
 * goes without sighted users having to read it.
 */
export function BackLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={typeof children === "string" ? children : undefined}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-b2b-purple/15 text-b2b-ink/60 hover:bg-b2b-bg ${className}`}
    >
      <BackIcon className="h-4 w-4 shrink-0" />
    </Link>
  );
}
