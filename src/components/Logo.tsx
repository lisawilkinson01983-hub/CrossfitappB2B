import Link from "next/link";

/**
 * Text-based stand-in for the real logo asset (interlocking squares,
 * white + pink/purple gradient, on a dark violet card). Swap the contents
 * of this component for the real logo image whenever it's available —
 * every place that uses the brand mark imports this one component.
 */
export function Logo({ size = "md", href }: { size?: "sm" | "md" | "lg"; href?: string }) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-3xl",
    lg: "text-6xl",
  }[size];

  const mark = (
    <span
      className={`font-display bg-gradient-to-r from-b2b-pink to-b2b-purple bg-clip-text text-transparent ${sizeClasses}`}
    >
      BOX 2 BOX
    </span>
  );

  if (!href) return mark;

  return <Link href={href}>{mark}</Link>;
}
