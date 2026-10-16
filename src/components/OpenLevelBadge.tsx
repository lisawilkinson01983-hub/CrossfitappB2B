// A circular "rank medallion" — LEVEL spelled out above a big number,
// inside a double-ring border — for an athlete's self-reported CrossFit
// Open level (1-10). Own shape/colors (brand gold, not CrossFit's own blue
// shield mark), just the same "quick at-a-glance rank badge" idea the user
// asked to borrow. Only used where there's room for the word in full —
// the carousel card corner and the profile hero — never shrunk onto a
// small list-row avatar.
const SIZES = {
  sm: { box: 36, ring: 2, levelText: "6px", numberText: "14px" },
  lg: { box: 64, ring: 3, levelText: "9px", numberText: "23px" },
} as const;

export function OpenLevelBadge({ level, size = "sm" }: { level: number; size?: keyof typeof SIZES }) {
  const { box, ring, levelText, numberText } = SIZES[size];
  return (
    <div
      role="img"
      aria-label={`CrossFit Open level ${level}`}
      className="flex shrink-0 flex-col items-center justify-center rounded-full bg-b2b-pink text-white shadow-sm"
      style={{
        width: box,
        height: box,
        border: `${ring}px solid rgba(255,255,255,0.55)`,
      }}
    >
      <span
        className="font-sans font-bold uppercase leading-none tracking-wide"
        style={{ fontSize: levelText, marginTop: box * 0.05 }}
      >
        Level
      </span>
      <span className="font-display leading-none" style={{ fontSize: numberText, marginTop: box * 0.02 }}>
        {level}
      </span>
    </div>
  );
}
