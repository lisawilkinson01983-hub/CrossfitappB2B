import type {
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

export const PB_LABELS: Record<PbField, string> = {
  deadliftKg: "Deadlift",
  cleanKg: "Clean",
  frontSquatKg: "Front squat",
  backSquatKg: "Back squat",
  ohsKg: "OHS",
  snatchKg: "Snatch",
  benchPressKg: "Bench press",
  splitJerkKg: "Split jerk",
};

export const WORKOUT_UNIT_LABELS: Record<WorkoutUnitOption, string> = {
  TIME: "Time",
  REPS: "Reps",
  WEIGHT: "Weight",
};

export const WORKOUT_INTENSITY_LABELS: Record<WorkoutIntensityOption, string> = {
  RX: "Rx",
  SCALED: "Scaled",
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
