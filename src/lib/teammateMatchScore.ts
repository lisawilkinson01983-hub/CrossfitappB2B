// Scores how good a teammate match a candidate athlete is for the viewer,
// for the "Suggested for you" rail on an event's find-a-teammate page (see
// src/components/SuggestedTeammates.tsx). Not machine-learned — a plain
// weighted blend of four signals, each worth up to 25 points out of 100:
// ability (levels + Open Level), distance, shared PBs, and shared
// named-benchmark times. A signal neither side has data for is scored
// neutral (half credit) rather than zero, so a thin profile isn't
// unfairly punished — expect these weights to get tuned once this sees
// real use, not to be exactly right on day one.
import { LEVEL_LABELS, PB_LABELS } from "@/lib/labels";
import type { LevelOption, PbField } from "@/lib/validation";
import { WOD_DATABASE_BY_NAME } from "@/lib/wodDatabase";
import { distanceMiles, type Coords } from "@/lib/geocode";

const POINTS_PER_SIGNAL = 25;

export type MatchProfile = {
  id: string;
  levels: LevelOption[];
  openLevel: number | null;
  pbs: Partial<Record<PbField, number | null>>;
};

export type MatchWorkout = {
  wodName: string;
  unit: "TIME" | "REPS" | "WEIGHT" | "ROUNDS_REPS";
  score: string | null;
  rounds: number | null;
  reps: number | null;
};

export type MatchResult = {
  score: number; // 1-99
  reasons: string[]; // ordered, most notable first — the UI shows the top 2
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// "12:34" or "1:02:34" -> seconds. Returns null for anything else (a REPS/
// WEIGHT-unit score, or text that doesn't parse) — not every score string
// is a time.
function parseTimeSeconds(score: string): number | null {
  const parts = score.trim().split(":").map((p) => Number(p));
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => Number.isNaN(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

// Leading number out of a free-text REPS/WEIGHT score like "150 reps" or
// "225 lb" — approximate on purpose, just enough to compare two athletes'
// numbers on the same named WOD.
function parseLeadingNumber(score: string): number | null {
  const match = score.trim().match(/^[\d.]+/);
  return match ? Number(match[0]) : null;
}

function workoutMagnitude(w: MatchWorkout): number | null {
  if (w.unit === "ROUNDS_REPS") {
    if (w.rounds == null) return null;
    return w.rounds * 1000 + (w.reps ?? 0);
  }
  if (!w.score) return null;
  if (w.unit === "TIME") return parseTimeSeconds(w.score);
  return parseLeadingNumber(w.score);
}

function similarity(a: number, b: number): number {
  const maxVal = Math.max(Math.abs(a), Math.abs(b), 1);
  return 1 - clamp(Math.abs(a - b) / maxVal, 0, 1);
}

function abilityScore(
  me: MatchProfile,
  candidate: MatchProfile
): { points: number; reason: string | null } {
  const sharedLevel = me.levels.find((l) => candidate.levels.includes(l));
  const levelPoints = sharedLevel ? POINTS_PER_SIGNAL * 0.5 : 0;

  let openLevelPoints = POINTS_PER_SIGNAL * 0.25; // neutral when either side hasn't set one
  let openLevelReason: string | null = null;
  if (me.openLevel != null && candidate.openLevel != null) {
    const diff = Math.abs(me.openLevel - candidate.openLevel);
    openLevelPoints = clamp((POINTS_PER_SIGNAL * 0.5) * (1 - diff / 8), 0, POINTS_PER_SIGNAL * 0.5);
    if (diff <= 2) openLevelReason = `Open Level ${candidate.openLevel} (yours: ${me.openLevel})`;
  }

  const reason =
    openLevelReason ?? (sharedLevel ? `Both ${LEVEL_LABELS[sharedLevel]}` : null);

  return { points: levelPoints + openLevelPoints, reason };
}

function distanceScore(myCoords: Coords | null, theirCoords: Coords | null): { points: number; reason: string | null } {
  if (!myCoords || !theirCoords) return { points: POINTS_PER_SIGNAL * 0.5, reason: null };
  const miles = distanceMiles(myCoords, theirCoords);
  const points = clamp(POINTS_PER_SIGNAL * (1 - miles / 50), 1, POINTS_PER_SIGNAL);
  return { points, reason: `${miles < 1 ? "<1" : miles.toFixed(1)} mi away` };
}

function pbScore(me: MatchProfile, candidate: MatchProfile): { points: number; reason: string | null } {
  const shared = (Object.keys(me.pbs) as PbField[]).filter(
    (field) => me.pbs[field] != null && candidate.pbs[field] != null
  );
  if (shared.length === 0) return { points: POINTS_PER_SIGNAL * 0.5, reason: null };

  const sims = shared.map((field) => similarity(me.pbs[field]!, candidate.pbs[field]!));
  const avg = sims.reduce((a, b) => a + b, 0) / sims.length;

  // Name the 1-2 closest lifts for the reason line.
  const closest = shared
    .map((field, i) => ({ field, sim: sims[i] }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 2)
    .map(({ field }) => PB_LABELS[field]);

  return {
    points: avg * POINTS_PER_SIGNAL,
    reason: avg > 0.7 ? `Similar ${closest.join(" & ")}` : null,
  };
}

function benchmarkScore(
  meWorkouts: MatchWorkout[],
  candidateWorkouts: MatchWorkout[]
): { points: number; reason: string | null } {
  const byName = (list: MatchWorkout[]) => {
    const map = new Map<string, MatchWorkout>();
    for (const w of list) {
      const key = w.wodName.trim().toLowerCase();
      if (WOD_DATABASE_BY_NAME.has(key) && !map.has(key)) map.set(key, w);
    }
    return map;
  };

  const mine = byName(meWorkouts);
  const theirs = byName(candidateWorkouts);
  const sharedNames = [...mine.keys()].filter((name) => theirs.has(name));
  if (sharedNames.length === 0) return { points: POINTS_PER_SIGNAL * 0.5, reason: null };

  const entries = sharedNames
    .map((name) => {
      const a = workoutMagnitude(mine.get(name)!);
      const b = workoutMagnitude(theirs.get(name)!);
      if (a == null || b == null) return null;
      return { name: mine.get(name)!.wodName, sim: similarity(a, b), unit: mine.get(name)!.unit, a, b };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (entries.length === 0) return { points: POINTS_PER_SIGNAL * 0.5, reason: null };

  const avg = entries.reduce((sum, e) => sum + e.sim, 0) / entries.length;
  const best = entries.sort((a, b) => b.sim - a.sim)[0];

  let reason: string | null = null;
  if (best.sim > 0.75) {
    if (best.unit === "TIME") {
      const diffSec = Math.abs(best.a - best.b);
      reason = `${best.name} within ${Math.round(diffSec)}s of yours`;
    } else {
      reason = `Similar ${best.name} score`;
    }
  }

  return { points: avg * POINTS_PER_SIGNAL, reason };
}

export function scoreTeammateMatch(
  me: MatchProfile & { coords: Coords | null; workouts: MatchWorkout[] },
  candidate: MatchProfile & { coords: Coords | null; workouts: MatchWorkout[] }
): MatchResult {
  const ability = abilityScore(me, candidate);
  const distance = distanceScore(me.coords, candidate.coords);
  const pb = pbScore(me, candidate);
  const benchmark = benchmarkScore(me.workouts, candidate.workouts);

  const total = ability.points + distance.points + pb.points + benchmark.points;
  const score = Math.round(clamp(total, 1, 99));

  // Distance leads when known (it's the most legible at a glance), then
  // whichever of the rest actually found something to say.
  const reasons = [distance.reason, benchmark.reason, pb.reason, ability.reason].filter(
    (r): r is string => r !== null
  );

  return { score, reasons: reasons.slice(0, 2) };
}
