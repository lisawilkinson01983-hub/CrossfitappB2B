import Link from "next/link";

const SIZES = {
  sm: { icon: 28, text: "text-xl", layout: "row" as const, gap: "gap-2" },
  md: { icon: 44, text: "text-3xl", layout: "row" as const, gap: "gap-3" },
  lg: { icon: 96, text: "text-6xl", layout: "col" as const, gap: "gap-4" },
};

/** Two interlocking rounded squares — one box connecting to another. */
function LogoMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className="shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="b2bLogoGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-b2b-pink)" />
          <stop offset="100%" stopColor="var(--color-b2b-purple)" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="56" height="56" rx="14" stroke="currentColor" strokeWidth="9" />
      <rect x="36" y="36" width="56" height="56" rx="14" stroke="url(#b2bLogoGradient)" strokeWidth="9" />
    </svg>
  );
}

export function Logo({ size = "md", href }: { size?: "sm" | "md" | "lg"; href?: string }) {
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
      className={`inline-flex items-center ${layout === "col" ? "flex-col" : "flex-row"} ${gap}`}
    >
      <LogoMark size={icon} />
      {wordmark}
    </span>
  );

  if (!href) return mark;

  return <Link href={href}>{mark}</Link>;
}
