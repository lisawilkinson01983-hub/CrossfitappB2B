import Image from "next/image";
import type { EventPlatform } from "@/lib/eventWebsite";

const PLATFORM_LABELS: Record<EventPlatform, string> = {
  aretas: "Aretas Event",
  "competition-corner": "Competition Corner Event",
  circle21: "Circle 21 Event",
};

// Brand accent per platform — used for the badge's text color and (for the
// two drawn-from-scratch marks) the ring around their icon.
const PLATFORM_ACCENTS: Record<EventPlatform, string> = {
  aretas: "#c3dd3a",
  "competition-corner": "#ffd400",
  circle21: "#f7931e",
};

/** Competition Corner's mark: a double chevron over their interlocking "C" loop, ringed in their yellow. */
function CompetitionCornerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#000" stroke="#ffd400" strokeWidth="1.6" />
      <path d="M7.5 8 L12 12 L16.5 8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 12 L12 16 L16.5 12" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Circle 21's mark: their "21" wordmark ringed in their orange. */
function Circle21Icon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#000" stroke="#f7931e" strokeWidth="2" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff">
        21
      </text>
    </svg>
  );
}

/** A small badge naming which registration platform an event's "Register" button links to. */
export function EventPlatformBadge({ platform }: { platform: EventPlatform }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1c1c] py-1 pl-1 pr-3 text-xs font-semibold"
      style={{ color: PLATFORM_ACCENTS[platform] }}
    >
      {platform === "aretas" ? (
        <Image src="/aretas-logo.png" alt="" width={18} height={18} className="rounded-full" />
      ) : platform === "competition-corner" ? (
        <CompetitionCornerIcon />
      ) : (
        <Circle21Icon />
      )}
      {PLATFORM_LABELS[platform]}
    </span>
  );
}
