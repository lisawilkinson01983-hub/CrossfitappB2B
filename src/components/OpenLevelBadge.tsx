// A hexagonal "rank badge" — LEVEL on top, the number big below — for an
// athlete's self-reported CrossFit Open level (1-10). Own shape/colors
// (brand gold, not CrossFit's own blue shield mark), just the same "quick
// at-a-glance rank badge" idea the user asked to borrow.
const SIZES = {
  sm: { box: 34, levelText: "6px", numberText: "13px" },
  lg: { box: 52, levelText: "8px", numberText: "20px" },
} as const;

export function OpenLevelBadge({ level, size = "sm" }: { level: number; size?: keyof typeof SIZES }) {
  const { box, levelText, numberText } = SIZES[size];
  return (
    <div
      role="img"
      aria-label={`CrossFit Open level ${level}`}
      className="flex shrink-0 flex-col items-center justify-center bg-b2b-pink text-white shadow-sm"
      style={{
        width: box,
        height: box,
        clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
      }}
    >
      <span
        className="font-sans font-bold uppercase leading-none tracking-wide"
        style={{ fontSize: levelText, marginTop: box * 0.08 }}
      >
        Lvl
      </span>
      <span className="font-display leading-none" style={{ fontSize: numberText }}>
        {level}
      </span>
    </div>
  );
}
