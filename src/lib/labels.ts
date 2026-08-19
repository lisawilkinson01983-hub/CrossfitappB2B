import type { LevelOption, LookingForOption } from "./validation";

export const LEVEL_LABELS: Record<LevelOption, string> = {
  SCALED: "Scaled",
  INTERMEDIATE: "Intermediate",
  RX: "Rx",
};

export const LOOKING_FOR_LABELS: Record<LookingForOption, string> = {
  COMP_PARTNER: "Competition partner",
  TRAINING_FRIENDS: "Training friends",
  DEEPER_CONNECTION: "Deeper connection",
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
