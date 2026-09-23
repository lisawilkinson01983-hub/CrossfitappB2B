import { PB_FIELDS } from "./validation";
import type {
  AppThemeOption,
  EventDivisionOption,
  EventGenderCategoryOption,
  EventTeamFormatOption,
  GenderOption,
  LevelOption,
  LookingForOption,
  PbField,
  WorkoutIntensityOption,
  WorkoutUnitOption,
} from "./validation";

export const LEVEL_LABELS: Record<LevelOption, string> = {
  SCALED: "Scaled",
  INTERMEDIATE: "Intermediate",
  RX: "Rx",
};

// RX badges use the primary pink accent, Intermediate the secondary purple,
// per the brand spec; Scaled has no accent assigned, so it stays neutral.
export const LEVEL_BADGE_CLASSES: Record<LevelOption, string> = {
  SCALED: "bg-gray-100 text-gray-600",
  INTERMEDIATE: "bg-b2b-purple/10 text-b2b-purple",
  RX: "bg-b2b-pink/10 text-b2b-pink",
};

export const GENDER_LABELS: Record<GenderOption, string> = {
  MALE: "Male",
  FEMALE: "Female",
  PREFER_NOT_TO_DISCLOSE: "Prefer not to disclose",
};

export const LOOKING_FOR_LABELS: Record<LookingForOption, string> = {
  TEAM_MATES: "Team mates",
  FRIENDS: "Friends",
  DEEPER_CONNECTION: "Deeper connection",
};

export const EVENT_DIVISION_LABELS: Record<EventDivisionOption, string> = {
  SCALED: "Scaled",
  RX: "Rx",
  INTERMEDIATE: "Intermediate",
};

export const EVENT_TEAM_FORMAT_LABELS: Record<EventTeamFormatOption, string> = {
  SINGLES: "Singles",
  PAIRS: "Pairs",
  TEAMS: "Teams",
};

export const EVENT_GENDER_CATEGORY_LABELS: Record<EventGenderCategoryOption, string> = {
  MALE: "Male",
  FEMALE: "Female",
  MIXED: "Mixed",
};

export const PB_LABELS: Record<PbField, string> = {
  backSquatKg: "Back Squat",
  frontSquatKg: "Front Squat",
  ohsKg: "Overhead Squat",
  deadliftKg: "Deadlift",
  sumoDeadliftKg: "Sumo Deadlift",
  deficitDeadliftKg: "Deficit Deadlift",
  cleanPullKg: "Clean Pull",
  snatchPullKg: "Snatch Pull",
  cleanKg: "Clean",
  powerCleanKg: "Power Clean",
  hangCleanKg: "Hang Clean",
  hangPowerCleanKg: "Hang Power Clean",
  cleanAndJerkKg: "Clean and Jerk",
  snatchKg: "Snatch",
  powerSnatchKg: "Power Snatch",
  hangSnatchKg: "Hang Snatch",
  hangPowerSnatchKg: "Hang Power Snatch",
  splitJerkKg: "Split Jerk",
  pushJerkKg: "Push Jerk",
  strictPressKg: "Strict Press",
  shoulderPressKg: "Shoulder Press",
  pushPressKg: "Push Press",
  benchPressKg: "Bench Press",
};

// Before a user customizes their selection (displayedPbs is null), these are
// shown on their profile — the original fixed 8 PBs the app launched with.
export const DEFAULT_DISPLAYED_PBS: PbField[] = [
  "deadliftKg",
  "cleanKg",
  "frontSquatKg",
  "backSquatKg",
  "ohsKg",
  "snatchKg",
  "benchPressKg",
  "splitJerkKg",
];

export function parseDisplayedPbs(value: string | null): PbField[] {
  if (value == null) return DEFAULT_DISPLAYED_PBS;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is PbField => PB_FIELDS.includes(v)) : [];
  } catch {
    return [];
  }
}

export const WORKOUT_UNIT_LABELS: Record<WorkoutUnitOption, string> = {
  TIME: "Time",
  REPS: "Reps",
  WEIGHT: "Weight",
  ROUNDS_REPS: "Rounds + Reps",
};

export const WORKOUT_INTENSITY_LABELS: Record<WorkoutIntensityOption, string> = {
  RX: "Rx",
  SCALED: "Scaled",
};

export const APP_THEME_LABELS: Record<AppThemeOption, string> = {
  PINK: "Pink & Purple",
  BLUE: "Ocean Blue",
};

// Fixed swatch hexes for the theme picker itself — these must stay literal
// (not var(--color-b2b-*)) so both options preview correctly no matter which
// theme is currently active.
export const APP_THEME_SWATCHES: Record<AppThemeOption, [string, string]> = {
  PINK: ["#eb4e94", "#7a2fb8"],
  BLUE: ["#2f6fed", "#1e3a8a"],
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The green-heart badge only ever shows when isSingle is true and the user opted into it. */
export function showsSingleBadge(user: { isSingle: boolean | null; showSingleBadge: boolean }): boolean {
  return user.isSingle === true && user.showSingleBadge;
}

export function parseLookingFor(value: string | null): LookingForOption[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Parses any JSON-encoded-array string column (Event.division/teamFormat/genderCategory, etc). */
export function parseJsonArray<T extends string>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
