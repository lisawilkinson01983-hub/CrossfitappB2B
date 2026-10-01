import Image from "next/image";
import type { EventPlatform } from "@/lib/eventWebsite";

const PLATFORM_LABELS: Record<EventPlatform, string> = {
  aretas: "Aretas Event",
  "competition-corner": "Competition Corner Event",
  circle21: "Circle 21 Event",
};

const ICON_SIZE = 32;

/** Competition Corner's mark: a double chevron over their interlocking "C" loop, ringed in their yellow. */
function CompetitionCornerIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#000" stroke="#ffd400" strokeWidth="1.6" />
      <path d="M7.5 8 L12 12 L16.5 8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 12 L12 16 L16.5 12" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Circle 21's mark: their "21" wordmark ringed in their orange. */
function Circle21Icon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#000" stroke="#f7931e" strokeWidth="2" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff">
        21
      </text>
    </svg>
  );
}

/** Just the registration platform's own logo/mark — no label, so it reads as a small brand mark rather than another piece of text to parse. */
export function EventPlatformBadge({ platform }: { platform: EventPlatform }) {
  return (
    <span role="img" aria-label={PLATFORM_LABELS[platform]} className="block drop-shadow">
      {platform === "aretas" ? (
        <Image src="/aretas-logo.png" alt="" width={ICON_SIZE} height={ICON_SIZE} className="rounded-full" />
      ) : platform === "competition-corner" ? (
        <CompetitionCornerIcon />
      ) : (
        <Circle21Icon />
      )}
    </span>
  );
}
