import Link from "next/link";
import { BackIcon } from "@/components/BackIcon";

/** A "go back/up" link — an arrow icon plus label, replacing the old underlined "← Back to X" text links everywhere one was used. */
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
      className={`inline-flex items-center gap-1.5 text-sm text-b2b-pink hover:underline ${className}`}
    >
      <BackIcon className="h-4 w-4 shrink-0" />
      {children}
    </Link>
  );
}
