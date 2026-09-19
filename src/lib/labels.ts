import type { GenderOption, LevelOption, LookingForOption, PbField } from "./validation";

export const LEVEL_LABELS: Record<LevelOption, string> = {
  SCALED: "Scaled",
  INTERMEDIATE: "Intermediate",
  RX: "Rx",
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

export function parseLookingFor(value: string | null): LookingForOption[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
