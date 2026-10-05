import Image from "next/image";

export function Avatar({
  photo,
  name,
  size,
  showSingleBadge,
  verified,
  fallback = "initial",
}: {
  photo: string | null;
  name: string;
  size: number;
  showSingleBadge?: boolean;
  // A verified AFFILIATE (see Gym.claimedById) — shown as a gold tick badge
  // on the avatar itself, since the photo is often all that's visible (a
  // feed post, a comment) and the only place the ✓ previously appeared was
  // text next to a name on the full profile page. showSingleBadge and this
  // never co-occur (ATHLETE vs AFFILIATE only), so sharing the corner is safe.
  verified?: boolean;
  // What to show with no photo: the name's first letter (people), or a
  // generic gym icon (affiliates, whose names nearly all start with "C").
  fallback?: "initial" | "gym";
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        <Image
          src={photo}
          alt={`${name}'s photo`}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
        />
      ) : fallback === "gym" ? (
        <GymIcon />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-b2b-purple/10 font-semibold text-b2b-purple"
          style={{ fontSize: size * 0.4 }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {showSingleBadge && (
        <span
          title="Single"
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-b2b-card shadow"
          style={{ width: size * 0.32, height: size * 0.32, fontSize: size * 0.2 }}
        >
          💚
        </span>
      )}
      {verified && (
        <span
          title="Verified affiliate"
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full shadow"
          style={{
            width: size * 0.34,
            height: size * 0.34,
            backgroundColor: "#e0a83a",
            border: `${Math.max(1, size * 0.02)}px solid white`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" style={{ width: "62%", height: "62%" }}>
            <path
              d="M5 12.5 10 17 19 7"
              stroke="white"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </div>
  );
}

// A roll-up-door unit: the classic CrossFit box, in the brand's charcoal and gold.
function GymIcon() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Gym">
      <circle cx="50" cy="50" r="50" fill="#232223" />
      <g fill="none" stroke="#e0a83a" strokeLinejoin="round">
        <path d="M24 72V40l26-14 26 14v32" strokeWidth="5" />
        <path d="M34 72V50h32v22" strokeWidth="4.5" />
        <path d="M34 57h32M34 64h32" strokeWidth="3" opacity=".75" />
        <path d="M19 72h62" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
