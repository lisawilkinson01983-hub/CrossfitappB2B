import Link from "next/link";
import Image from "next/image";

const NO_PHOTO_PATTERN = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(184,132,42,0.22) 0px, rgba(184,132,42,0.22) 2px, transparent 2px, transparent 18px)",
};

export type SuggestedTeammate = {
  id: string;
  name: string;
  photo: string | null;
  score: number; // 1-99
  subtitle: string | null; // e.g. "Rx · Level 6"
  reasons: string[]; // up to 2, shown as separate lines
};

function MatchRing({ score }: { score: number }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#B8842A 0% ${score}%, rgba(255,255,255,0.3) ${score}% 100%)` }}
    >
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-b2b-ink">
        <span className="font-display text-[10px] leading-none text-b2b-bg">{score}%</span>
      </div>
    </div>
  );
}

const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="10" height="10" className="shrink-0" aria-hidden="true">
    <path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12Z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

const StopwatchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="10" height="10" className="shrink-0" aria-hidden="true">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 13V9M9 3h6" />
  </svg>
);

/**
 * A horizontally-scrolling row of ranked teammate suggestions, above the
 * normal filtered interested-athletes list on an event's find-a-teammate
 * page — see src/lib/teammateMatch.ts for how the score/reasons are
 * computed. Same card language as SwipeCardList's carousel, with a match
 * score ring in place of the Open Level badge's corner (so the two never
 * collide) and the "why" shown as two short lines instead of relying on a
 * subtitle alone.
 */
export function SuggestedTeammates({ items }: { items: SuggestedTeammate[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">Suggested for you</p>
        <p className="text-[11px] text-b2b-ink/35">Based on ability, PBs &amp; distance</p>
      </div>
      <div className="-mx-4 mt-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/profile/${item.id}`}
            className="relative h-[200px] w-[150px] shrink-0 overflow-hidden rounded-xl"
          >
            {item.photo ? (
              <Image src={item.photo} alt="" fill sizes="150px" className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-b2b-ink" style={NO_PHOTO_PATTERN}>
                <span className="font-display text-6xl leading-none text-b2b-pink/70">{item.name.charAt(0).toUpperCase()}</span>
              </div>
            )}

            <div className="absolute right-2 top-2">
              <MatchRing score={item.score} />
            </div>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/45 to-transparent p-2.5">
              <p className="truncate font-display text-sm leading-tight text-white">{item.name}</p>
              {item.subtitle && <p className="mt-0.5 text-[10px] font-semibold text-white/70">{item.subtitle}</p>}
              {item.reasons.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {item.reasons.map((reason, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px] text-white/85">
                      {i === 0 ? <PinIcon /> : <StopwatchIcon />}
                      <span className="truncate">{reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
