import { MessageButton } from "@/components/MessageButton";
import { SwipeCardList, type SwipeCardItem } from "@/components/SwipeCardList";
import { LEVEL_LABELS } from "@/lib/labels";
import type { LevelOption } from "@/lib/validation";

export type InterestedAthlete = {
  id: string;
  name: string;
  photo: string | null;
  levels: LevelOption[];
  area: string | null;
  affiliateGym: string | null;
  isSingle: boolean | null;
  showSingleBadge: boolean;
};

/**
 * Browse athletes who've marked themselves "interested" in this event — as a
 * swipeable one-at-a-time carousel or a plain list (see SwipeCardList).
 * Sits above EventNoticesPanel on the find-teammate page: this is for
 * browsing who's already around, posting a request is the separate section
 * below.
 */
export function InterestedAthletesCarousel({ athletes }: { athletes: InterestedAthlete[] }) {
  const items: SwipeCardItem[] = athletes.map((a) => ({
    id: a.id,
    image: a.photo,
    initial: a.name.charAt(0),
    title: a.name,
    badges: a.levels.map((lvl) => LEVEL_LABELS[lvl]),
    subtitle: [a.area, a.affiliateGym].filter(Boolean).join(" · ") || null,
    href: `/profile/${a.id}`,
    action: <MessageButton targetUserId={a.id} />,
    compactAction: <MessageButton targetUserId={a.id} compact />,
  }));

  return (
    <SwipeCardList
      items={items}
      emptyMessage="No one's marked interested yet — check back later."
      label={`${athletes.length} ${athletes.length === 1 ? "athlete" : "athletes"} interested`}
    />
  );
}
