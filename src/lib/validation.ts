import { z } from "zod";
import { AFFILIATE_GYM_VALUES, OTHER_GYM } from "./gyms";

export const LEVELS = ["SCALED", "INTERMEDIATE", "RX"] as const;
export type LevelOption = (typeof LEVELS)[number];

export const GENDERS = ["MALE", "FEMALE", "PREFER_NOT_TO_DISCLOSE"] as const;
export type GenderOption = (typeof GENDERS)[number];

export const LOOKING_FOR_OPTIONS = ["TEAM_MATES", "FRIENDS", "DEEPER_CONNECTION"] as const;
export type LookingForOption = (typeof LOOKING_FOR_OPTIONS)[number];

export const WORKOUT_UNITS = ["TIME", "REPS", "WEIGHT", "ROUNDS_REPS"] as const;
export type WorkoutUnitOption = (typeof WORKOUT_UNITS)[number];

export const WORKOUT_INTENSITIES = ["RX", "SCALED"] as const;
export type WorkoutIntensityOption = (typeof WORKOUT_INTENSITIES)[number];

export const APP_THEMES = ["PINK", "BLUE"] as const;
export type AppThemeOption = (typeof APP_THEMES)[number];

export const EVENT_DIVISIONS = ["SCALED", "RX", "INTERMEDIATE"] as const;
export type EventDivisionOption = (typeof EVENT_DIVISIONS)[number];

export const EVENT_TEAM_FORMATS = ["SINGLES", "PAIRS", "TEAMS"] as const;
export type EventTeamFormatOption = (typeof EVENT_TEAM_FORMATS)[number];

export const EVENT_GENDER_CATEGORIES = ["MALE", "FEMALE", "MIXED"] as const;
export type EventGenderCategoryOption = (typeof EVENT_GENDER_CATEGORIES)[number];

// For a "looking for teammates" notice request — distinct from the event's
// own EventGenderCategory/EventDivision since a request about one person
// also needs an "any" option.
export const TEAMMATE_GENDERS = ["MALE", "FEMALE", "ANY"] as const;
export type TeammateGenderOption = (typeof TEAMMATE_GENDERS)[number];

export const TEAMMATE_DIVISIONS = ["SCALED", "INTERMEDIATE", "RX", "ANY"] as const;
export type TeammateDivisionOption = (typeof TEAMMATE_DIVISIONS)[number];

// The full benchmark-movement catalog.
export const PB_FIELDS = [
  "backSquatKg",
  "frontSquatKg",
  "ohsKg",
  "deadliftKg",
  "sumoDeadliftKg",
  "deficitDeadliftKg",
  "cleanPullKg",
  "snatchPullKg",
  "cleanKg",
  "powerCleanKg",
  "hangCleanKg",
  "hangPowerCleanKg",
  "cleanAndJerkKg",
  "snatchKg",
  "powerSnatchKg",
  "hangSnatchKg",
  "hangPowerSnatchKg",
  "splitJerkKg",
  "pushJerkKg",
  "strictPressKg",
  "shoulderPressKg",
  "pushPressKg",
  "benchPressKg",
] as const;
export type PbField = (typeof PB_FIELDS)[number];

// Grouped the way they're presented in the "Add more" picker on the
// edit-profile form.
export const PB_CATEGORIES: { label: string; fields: PbField[] }[] = [
  { label: "Squats", fields: ["backSquatKg", "frontSquatKg", "ohsKg"] },
  {
    label: "Deadlift family",
    fields: ["deadliftKg", "sumoDeadliftKg", "deficitDeadliftKg", "cleanPullKg", "snatchPullKg"],
  },
  {
    label: "Clean variations",
    fields: ["cleanKg", "powerCleanKg", "hangCleanKg", "hangPowerCleanKg", "cleanAndJerkKg"],
  },
  {
    label: "Snatch variations",
    fields: ["snatchKg", "powerSnatchKg", "hangSnatchKg", "hangPowerSnatchKg"],
  },
  { label: "Jerk variations", fields: ["splitJerkKg", "pushJerkKg"] },
  { label: "Presses", fields: ["strictPressKg", "shoulderPressKg", "pushPressKg", "benchPressKg"] },
];

// A user can record any number of PBs, but only this many show on their
// profile at once. Before a user has customized their selection, these
// original 8 fields are used as the default (see DEFAULT_DISPLAYED_PBS in
// src/lib/labels.ts).
export const MAX_DISPLAYED_PBS = 8;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Treat empty-string form fields as "not provided" instead of failing validation. */
const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

/** Form checkboxes send "on" when checked and nothing at all when unchecked. */
const checkboxToBoolean = z.preprocess((v) => v === "on" || v === true, z.boolean());

/** A three-way Yes/No/unanswered select, sent as "true" | "false" | "". */
const optionalYesNo = z.preprocess(
  emptyToUndefined,
  z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true"))
);

const optionalPositiveKg = z.preprocess(emptyToUndefined, z.coerce.number().positive().optional());

export const profileSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    bio: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
    age: z.preprocess(emptyToUndefined, z.coerce.number().int().min(13).max(120).optional()),
    gender: z.preprocess(emptyToUndefined, z.enum(GENDERS).optional()),
    area: z.string().trim().min(1, "Area is required"),
    affiliateGym: z.enum(AFFILIATE_GYM_VALUES, { errorMap: () => ({ message: "Select a gym" }) }),
    affiliateGymOther: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    level: z.enum(LEVELS, { errorMap: () => ({ message: "Select a level" }) }),
    crossfitSinceYear: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1970).max(new Date().getFullYear()).optional()
    ),
    crossfitSinceMonth: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(12).optional()),
    lookingFor: z.array(z.enum(LOOKING_FOR_OPTIONS)).default([]),
    showLookingFor: checkboxToBoolean,
    isSingle: optionalYesNo,
    showRelationshipStatus: checkboxToBoolean,
    showSingleBadge: checkboxToBoolean,
    showAge: checkboxToBoolean,
    isPrivate: checkboxToBoolean,
    ...(Object.fromEntries(PB_FIELDS.map((field) => [field, optionalPositiveKg])) as Record<
      PbField,
      typeof optionalPositiveKg
    >),
    displayedPbs: z
      .array(z.enum(PB_FIELDS))
      .max(MAX_DISPLAYED_PBS, `You can display up to ${MAX_DISPLAYED_PBS} PBs`)
      .default([]),
  })
  .refine((data) => data.affiliateGym !== OTHER_GYM || !!data.affiliateGymOther, {
    message: "Enter your gym name",
    path: ["affiliateGymOther"],
  });

export const workoutSchema = z.object({
  wodName: z.string().trim().min(1, "WOD name is required"),
  score: z.string().trim().min(1, "Score is required"),
  unit: z.enum(WORKOUT_UNITS, { errorMap: () => ({ message: "Select a unit" }) }),
  intensity: z.enum(WORKOUT_INTENSITIES, { errorMap: () => ({ message: "Select Rx or Scaled" }) }),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  isPb: checkboxToBoolean,
  sharedToFeed: checkboxToBoolean,
});

// contentText alone doesn't say whether a photo came along too, so "must have
// text or a photo" is checked in the route handler, not here.
export const postSchema = z.object({
  contentText: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1, "Comment can't be empty").max(1000),
});

// Two modes, one endpoint: a plain free-text notice (text required), or a
// structured "looking for teammates" request (quantity/gender/division all
// required, text optional extra detail). Never both empty.
export const eventNoticeSchema = z
  .object({
    text: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
    teammateQuantity: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(20).optional()),
    teammateGender: z.preprocess(emptyToUndefined, z.enum(TEAMMATE_GENDERS).optional()),
    teammateDivision: z.preprocess(emptyToUndefined, z.enum(TEAMMATE_DIVISIONS).optional()),
  })
  .refine(
    (data) =>
      data.teammateQuantity !== undefined || data.teammateGender !== undefined || data.teammateDivision !== undefined
        ? data.teammateQuantity !== undefined && data.teammateGender !== undefined && data.teammateDivision !== undefined
        : !!data.text,
    { message: "Fill in how many, gender, and division — or write a notice", path: ["text"] }
  );

// The image is a required upload, handled outside this schema (see
// /api/events/submit) the same way post/workout photos are.
export const eventSubmissionSchema = z.object({
  name: z.string().trim().min(1, "Event name is required"),
  date: z.coerce.date({ errorMap: () => ({ message: "Enter a valid date" }) }),
  location: z.string().trim().min(1, "Location is required"),
  websiteUrl: z.string().trim().url("Enter a valid website URL"),
  description: z.string().trim().min(1, "Event information is required").max(2000),
  division: z.array(z.enum(EVENT_DIVISIONS)).min(1, "Select at least one division"),
  teamFormat: z.array(z.enum(EVENT_TEAM_FORMATS)).min(1, "Select at least one team format"),
  genderCategory: z.array(z.enum(EVENT_GENDER_CATEGORIES)).min(1, "Select at least one gender category"),
});

export const messageSchema = z.object({
  text: z.string().trim().min(1, "Message can't be empty").max(2000),
});

export const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newEmail: z.string().trim().email("Enter a valid email address"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

