// Groups teammate-less, interested athletes of one gender into suggested
// full teams for a Male- or Female-pairs/teams event (see the find-a-
// teammate page). Deliberately a greedy nearest-neighbour clustering, not a
// real optimizer — at single-event scale (dozens of people, not thousands)
// that's cheap, easy to reason about, and plenty good.
import type { Coords } from "@/lib/geocode";
import { distanceMiles } from "@/lib/geocode";
import type { EventTeamFormatOption } from "@/lib/validation";

// No structured "how many per team" field exists on Event (see
// Event.tag's free-text "Team size: 3" comment in the schema) — these are
// reasonable defaults, not read from anywhere.
const TEAM_SIZE: Partial<Record<EventTeamFormatOption, number>> = {
  PAIRS: 2,
  TEAMS: 4,
};

export type TeammatePoolMember = {
  id: string;
  name: string;
  photo: string | null;
  openLevel: number | null;
  coords: Coords | null;
};

export type SuggestedTeam = {
  members: TeammatePoolMember[]; // includes "me" at index 0
  avgOpenLevel: number | null;
  maxSpreadMiles: number | null;
  confidence: "great" | "good";
};

function pairScore(a: TeammatePoolMember, b: TeammatePoolMember): number {
  const distance = a.coords && b.coords ? distanceMiles(a.coords, b.coords) : 25; // unknown -> mid-pack, not disqualifying
  const levelDiff = a.openLevel != null && b.openLevel != null ? Math.abs(a.openLevel - b.openLevel) : 2;
  // Distance dominates (it's the harder constraint to work around after the
  // fact), ability is a tiebreaker.
  return distance + levelDiff * 3;
}

function teamStats(members: TeammatePoolMember[]): { avgOpenLevel: number | null; maxSpreadMiles: number | null } {
  const levels = members.map((m) => m.openLevel).filter((l): l is number => l != null);
  const avgOpenLevel = levels.length > 0 ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null;

  const coordsList = members.map((m) => m.coords).filter((c): c is Coords => c != null);
  let maxSpreadMiles: number | null = null;
  for (let i = 0; i < coordsList.length; i++) {
    for (let j = i + 1; j < coordsList.length; j++) {
      const d = distanceMiles(coordsList[i], coordsList[j]);
      if (maxSpreadMiles == null || d > maxSpreadMiles) maxSpreadMiles = d;
    }
  }
  return { avgOpenLevel, maxSpreadMiles };
}

/**
 * Builds up to `maxTeams` suggested full teams for `me`, drawn from `pool`
 * (same-gender, teamless, interested athletes, not including me). Each team
 * has `teamSize` members total (me + teamSize-1 from the pool); a pool too
 * small to fill even one team returns an empty array.
 */
export function suggestTeams(
  me: TeammatePoolMember,
  pool: TeammatePoolMember[],
  teamFormat: EventTeamFormatOption,
  maxTeams = 2
): SuggestedTeam[] {
  const teamSize = TEAM_SIZE[teamFormat];
  if (!teamSize || pool.length < teamSize - 1) return [];

  const remaining = [...pool];
  const teams: SuggestedTeam[] = [];

  for (let t = 0; t < maxTeams && remaining.length >= teamSize - 1; t++) {
    // Greedy: repeatedly pull whoever scores best against the team-so-far's
    // closest member, starting from me.
    const members: TeammatePoolMember[] = [me];
    while (members.length < teamSize && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const scoreAgainstTeam = Math.min(...members.map((m) => pairScore(m, candidate)));
        if (scoreAgainstTeam < bestScore) {
          bestScore = scoreAgainstTeam;
          bestIdx = i;
        }
      }
      members.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }

    if (members.length < teamSize) break; // ran out of pool mid-team

    const { avgOpenLevel, maxSpreadMiles } = teamStats(members);
    const levelDiffs = members
      .map((m) => m.openLevel)
      .filter((l): l is number => l != null);
    const levelSpread = levelDiffs.length > 0 ? Math.max(...levelDiffs) - Math.min(...levelDiffs) : 0;
    const confidence: SuggestedTeam["confidence"] =
      (maxSpreadMiles == null || maxSpreadMiles <= 10) && levelSpread <= 2 ? "great" : "good";

    teams.push({ members, avgOpenLevel, maxSpreadMiles, confidence });
  }

  return teams;
}
