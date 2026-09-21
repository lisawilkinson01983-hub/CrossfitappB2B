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

export const PB_FIELDS = [
  "deadliftKg",
  "cleanKg",
  "frontSquatKg",
  "backSquatKg",
  "ohsKg",
  "snatchKg",
  "benchPressKg",
  "splitJerkKg",
] as const;
export type PbField = (typeof PB_FIELDS)[number];

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
    deadliftKg: optionalPositiveKg,
    cleanKg: optionalPositiveKg,
    frontSquatKg: optionalPositiveKg,
    backSquatKg: optionalPositiveKg,
    ohsKg: optionalPositiveKg,
    snatchKg: optionalPositiveKg,
    benchPressKg: optionalPositiveKg,
    splitJerkKg: optionalPositiveKg,
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

