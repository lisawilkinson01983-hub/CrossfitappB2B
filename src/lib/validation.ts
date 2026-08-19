import { z } from "zod";

export const LEVELS = ["SCALED", "INTERMEDIATE", "RX"] as const;
export type LevelOption = (typeof LEVELS)[number];

export const LOOKING_FOR_OPTIONS = [
  "COMP_PARTNER",
  "TRAINING_FRIENDS",
  "DEEPER_CONNECTION",
] as const;
export type LookingForOption = (typeof LOOKING_FOR_OPTIONS)[number];

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Treat empty-string form fields as "not provided" instead of failing validation. */
const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  bio: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  age: z.preprocess(emptyToUndefined, z.coerce.number().int().min(13).max(120).optional()),
  area: z.string().trim().min(1, "Area is required"),
  affiliateGym: z.string().trim().min(1, "Affiliate gym is required"),
  level: z.enum(LEVELS, { errorMap: () => ({ message: "Select a level" }) }),
  weightKg: z.preprocess(emptyToUndefined, z.coerce.number().positive().optional()),
  crossfitSinceYear: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1970).max(new Date().getFullYear()).optional()
  ),
  crossfitSinceMonth: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(12).optional()),
  lookingFor: z.array(z.enum(LOOKING_FOR_OPTIONS)).default([]),
});
