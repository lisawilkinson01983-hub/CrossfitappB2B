import Link from "next/link";
import Image from "next/image";

const SIZES = {
  sm: { icon: 28, wordmarkWidth: 168, layout: "row" as const, gap: "gap-2" },
  md: { icon: 44, wordmarkWidth: 260, layout: "row" as const, gap: "gap-3" },
  lg: { icon: 96, wordmarkWidth: 340, layout: "col" as const, gap: "gap-4" },
};

// public/logo-wordmark.png's own dimensions (900x126) — used to derive a
// height from whatever width a given size renders it at.
const WORDMARK_ASPECT = 900 / 126;

/** The two interlocking squares mark — see public/logo-mark.png (cropped/keyed from the source artwork). */
function LogoMark({ size }: { size: number }) {
  return <Image src="/logo-mark.png" alt="" width={size} height={size} className="shrink-0" priority />;
}

/** The "BOX 2 BOX" wordmark — see public/logo-wordmark.png (same source artwork as the mark, own custom typeface). */
function LogoWordmark({ width }: { width: number }) {
  return (
    <Image
      src="/logo-wordmark.png"
      alt="Box 2 Box"
      width={width}
      height={Math.round(width / WORDMARK_ASPECT)}
      className="shrink-0"
      priority
    />
  );
}

export function Logo({
  size = "md",
  href,
  wordmark: showWordmark = true,
}: {
  size?: "sm" | "md" | "lg";
  href?: string;
  /** False renders just the mark, no "BOX 2 BOX" wordmark — see NavBar. */
  wordmark?: boolean;
}) {
  const { icon, wordmarkWidth, layout, gap } = SIZES[size];

  const mark = (
    <span
      className={`inline-flex items-center ${layout === "col" ? "flex-col" : "flex-row"} ${
        showWordmark ? gap : ""
      }`}
    >
      <LogoMark size={icon} />
      {showWordmark && <LogoWordmark width={wordmarkWidth} />}
    </span>
  );

  if (!href) return mark;

  // With the wordmark hidden (NavBar), the icon alone (alt="") leaves the
  // link with no accessible name — give the link one directly instead.
  return (
    <Link href={href} aria-label={showWordmark ? undefined : "Box 2 Box"}>
      {mark}
    </Link>
  );
}
