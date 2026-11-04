import { EVENT_DIVISION_LABELS } from "@/lib/labels";
import type { EventDivisionOption, EventTeamFormatOption } from "@/lib/validation";

/** "1" -> "1ST", "12" -> "12TH", etc. — used for the result headline/badge. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}TH`;
  switch (n % 10) {
    case 1:
      return `${n}ST`;
    case 2:
      return `${n}ND`;
    case 3:
      return `${n}RD`;
    default:
      return `${n}TH`;
  }
}

/** The big headline for a result card/banner — "1ST PLACE", "12TH PLACE", or "COMPLETED". */
export function resultHeadline(result: { placementType: "EXACT" | "COMPLETED"; place: number | null }): string {
  if (result.placementType === "COMPLETED" || result.place == null) return "COMPLETED";
  return `${ordinal(result.place)} PLACE`;
}

/** True for the podium (shows a medal) vs. everything else. */
export function isPodiumPlace(place: number | null): boolean {
  return place != null && place >= 1 && place <= 3;
}

export function placeMedal(place: number | null): string | null {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return null;
}

/** Division dropdown options for the results-logging flow — the event's own
 * declared divisions when it set any, otherwise a sensible default list. */
export function divisionOptionsForEvent(event: { division: string | null }): string[] {
  if (event.division) {
    try {
      const parsed = JSON.parse(event.division) as EventDivisionOption[];
      const labels = parsed.map((d) => EVENT_DIVISION_LABELS[d]).filter(Boolean);
      if (labels.length > 0) return labels;
    } catch {
      // fall through to the default list below
    }
  }
  return ["Rx", "Scaled", "Intermediate"];
}

/** Whether an event's results should be grouped/listed by team rather than by athlete. */
export function isTeamFormatEvent(event: { teamFormat: string | null }): boolean {
  if (!event.teamFormat) return false;
  try {
    const parsed = JSON.parse(event.teamFormat) as EventTeamFormatOption[];
    return parsed.some((f) => f === "PAIRS" || f === "TEAMS");
  } catch {
    return false;
  }
}
