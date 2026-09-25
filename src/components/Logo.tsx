import Link from "next/link";
import Image from "next/image";

const SIZES = {
  sm: { icon: 28, text: "text-xl", layout: "row" as const, gap: "gap-2" },
  md: { icon: 44, text: "text-3xl", layout: "row" as const, gap: "gap-3" },
  lg: { icon: 96, text: "text-6xl", layout: "col" as const, gap: "gap-4" },
};

/** The two interlocking squares mark — see public/logo-mark.png (cropped/keyed from the source artwork). */
function LogoMark({ size }: { size: number }) {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={size}
      height={size}
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
  /** False renders just the mark, no "BOX 2 BOX" text — see NavBar. */
  wordmark?: boolean;
}) {
  const { icon, text, layout, gap } = SIZES[size];

  const wordmark = (
    <span className={`inline-block -skew-x-6 font-display ${text}`}>
      <span className="bg-gradient-to-r from-b2b-pink to-b2b-purple bg-clip-text text-transparent">
        BOX{" "}
      </span>
      <span className="text-b2b-pink">2</span>
      <span className="bg-gradient-to-r from-b2b-pink to-b2b-purple bg-clip-text text-transparent">
        {" "}BOX
      </span>
    </span>
  );

  const mark = (
    <span
      className={`inline-flex items-center ${layout === "col" ? "flex-col" : "flex-row"} ${
        showWordmark ? gap : ""
      }`}
    >
      <LogoMark size={icon} />
      {showWordmark && wordmark}
    </span>
  );

  if (!href) return mark;

  return <Link href={href}>{mark}</Link>;
}
