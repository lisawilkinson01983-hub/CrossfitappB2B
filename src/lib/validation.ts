import { z } from "zod";
import { OTHER_GYM } from "./gyms";
import { COUNTRIES } from "./countries";

export const LEVELS = ["SCALED", "INTERMEDIATE", "RX"] as const;
export type LevelOption = (typeof LEVELS)[number];

export const ACCOUNT_TYPES = ["ATHLETE", "AFFILIATE"] as const;
export type AccountTypeOption = (typeof ACCOUNT_TYPES)[number];

export const GENDERS = ["MALE", "FEMALE", "PREFER_NOT_TO_DISCLOSE"] as const;
export type GenderOption = (typeof GENDERS)[number];

export const LOOKING_FOR_OPTIONS = ["TEAM_MATES", "FRIENDS", "DEEPER_CONNECTION"] as const;
export type LookingForOption = (typeof LOOKING_FOR_OPTIONS)[number];

export const WORKOUT_UNITS = ["TIME", "REPS", "WEIGHT", "ROUNDS_REPS"] as const;
export type WorkoutUnitOption = (typeof WORKOUT_UNITS)[number];

export const WORKOUT_INTENSITIES = ["RX", "SCALED"] as const;
export type WorkoutIntensityOption = (typeof WORKOUT_INTENSITIES)[number];

export const EVENT_DIVISIONS = ["SCALED", "RX", "INTERMEDIATE"] as const;
export type EventDivisionOption = (typeof EVENT_DIVISIONS)[number];

export const EVENT_TEAM_FORMATS = ["SINGLES", "PAIRS", "TEAMS"] as const;
export type EventTeamFormatOption = (typeof EVENT_TEAM_FORMATS)[number];

export const EVENT_GENDER_CATEGORIES = ["MALE", "FEMALE", "MIXED"] as const;
export type EventGenderCategoryOption = (typeof EVENT_GENDER_CATEGORIES)[number];

export const REPORT_TARGET_TYPES = [
  "USER",
  "POST",
  "COMMENT",
  "MESSAGE",
  "EVENT_NOTICE",
  "EVENT_NOTICE_COMMENT",
] as const;
export type ReportTargetTypeOption = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "HATE",
  "NUDITY",
  "VIOLENCE",
  "SELF_HARM",
  "IMPERSONATION",
  "OTHER",
] as const;
export type ReportReasonOption = (typeof REPORT_REASONS)[number];

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
  agreedToTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms of Service and Privacy Policy" }),
  }),
  confirmedAge: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you're at least 18 years old" }),
  }),
  inviteCode: z.string().trim().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Treat empty-string form fields as "not provided" instead of failing validation. */
const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

/** Form checkboxes send "on" when checked and nothing at all when unchecked. */
export const checkboxToBoolean = z.preprocess((v) => v === "on" || v === true, z.boolean());

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
    // AFFILIATE accounts (a gym, not an athlete) skip level/PBs/relationship/
    // looking-for entirely — see the superRefine below and EditProfileForm.
    accountType: z.enum(ACCOUNT_TYPES).default("ATHLETE"),
    bio: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
    age: z.preprocess(emptyToUndefined, z.coerce.number().int().min(13).max(120).optional()),
    gender: z.preprocess(emptyToUndefined, z.enum(GENDERS).optional()),
    area: z.string().trim().min(1, "Area is required"),
    country: z.preprocess(emptyToUndefined, z.enum(COUNTRIES).optional()),
    // Not a fixed enum: any approved Gym name is selectable (see the dropdown
    // in EditProfileForm), not just the curated few in AFFILIATE_GYMS — the
    // route validates the submitted value against the actual Gym table.
    affiliateGym: z.string().trim().min(1, "Select a gym"),
    affiliateGymOther: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    level: z.preprocess(emptyToUndefined, z.enum(LEVELS).optional()),
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
    // Only meaningful for an AFFILIATE account — asks to be confirmed as the
    // legitimate owner/manager of the gym named in affiliateGym.
    verificationRequested: checkboxToBoolean,
    ...(Object.fromEntries(PB_FIELDS.map((field) => [field, optionalPositiveKg])) as Record<
      PbField,
      typeof optionalPositiveKg
    >),
    displayedPbs: z
      .array(z.enum(PB_FIELDS))
      .max(MAX_DISPLAYED_PBS, `You can display up to ${MAX_DISPLAYED_PBS} PBs`)
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.affiliateGym === OTHER_GYM && !data.affiliateGymOther) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter your gym name", path: ["affiliateGymOther"] });
    }
    if (data.accountType === "ATHLETE" && !data.level) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a level", path: ["level"] });
    }
    if (data.accountType === "ATHLETE" && data.lookingFor.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose at least one",
        path: ["lookingFor"],
      });
    }
  });

// Used by the quick PB editor on the profile page's "Key PBs" card — only
// the PB fields themselves, not the rest of profileSchema's required fields.
export const pbEditSchema = z.object({
  ...(Object.fromEntries(PB_FIELDS.map((field) => [field, optionalPositiveKg])) as Record<
    PbField,
    typeof optionalPositiveKg
  >),
  displayedPbs: z
    .array(z.enum(PB_FIELDS))
    .max(MAX_DISPLAYED_PBS, `You can display up to ${MAX_DISPLAYED_PBS} PBs`)
    .default([]),
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
  // Sent as an explicit "true"/"false" string (not a bare checkbox) so
  // "not sent at all" — the ordinary feed composer, which always shares to
  // the feed — can default to true, distinct from "sent as false" — media
  // added straight to the gallery with the "post to feed" option off.
  sharedToFeed: z
    .preprocess(emptyToUndefined, z.enum(["true", "false"]).optional())
    .transform((v) => v === undefined || v === "true"),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1, "Comment can't be empty").max(1000),
});

export const teammateRequestSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(20),
  gender: z.enum(TEAMMATE_GENDERS),
  division: z.enum(TEAMMATE_DIVISIONS),
});
export type TeammateRequest = z.infer<typeof teammateRequestSchema>;

// Two modes, one endpoint: a plain free-text notice (text required), or one
// or more structured "looking for teammates" requests for the same event —
// posted together as a single notice so they share one feed card. Never
// both empty.
export const eventNoticeSchema = z
  .object({
    text: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
    teammateRequests: z.array(teammateRequestSchema).max(20).optional(),
    // Also cross-post this search to the main feed (see linkedEventId on Post).
    postToFeed: z.boolean().optional(),
  })
  .refine((data) => (data.teammateRequests && data.teammateRequests.length > 0) || !!data.text, {
    message: "Add at least one athlete request — or write a notice",
    path: ["text"],
  });

// Editing an existing notice only ever changes its text — a free-text
// notice's message, or a teammate request's optional extra detail. The
// teammateRequests themselves aren't editable, same as a Post's linked
// workout/event isn't editable via postSchema.
export const eventNoticeEditSchema = z.object({
  text: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

// A saved "find a team" search (see EventTeammateAlert) — same
// gender/division shape as one line of a teammateRequestSchema, minus quantity.
export const teammateAlertSchema = z.object({
  gender: z.enum(TEAMMATE_GENDERS),
  division: z.enum(TEAMMATE_DIVISIONS),
});

// The image is a required upload, handled outside this schema (see
// /api/events/submit) the same way post/workout photos are.
export const eventSubmissionSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required"),
    date: z.coerce.date({ errorMap: () => ({ message: "Enter a valid start date" }) }),
    endDate: z.preprocess(emptyToUndefined, z.coerce.date({ errorMap: () => ({ message: "Enter a valid end date" }) }).optional()),
    isOnline: checkboxToBoolean,
    location: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    websiteUrl: z.string().trim().url("Enter a valid website URL"),
    description: z.string().trim().min(1, "Event information is required").max(2000),
    division: z.array(z.enum(EVENT_DIVISIONS)).min(1, "Select at least one division"),
    teamFormat: z.array(z.enum(EVENT_TEAM_FORMATS)).min(1, "Select at least one team format"),
    genderCategory: z.array(z.enum(EVENT_GENDER_CATEGORIES)).min(1, "Select at least one gender category"),
    // A private event skips review and is only visible to whoever's invited
    // (see EventInvite) — meant for social meetups and gym-only competitions
    // rather than public listings.
    isPrivate: checkboxToBoolean,
  })
  .superRefine((data, ctx) => {
    if (!data.isOnline && !data.location) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Location is required", path: ["location"] });
    }
    if (data.endDate && data.endDate < data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date can't be before the start date",
        path: ["endDate"],
      });
    }
  });

// Used only by an admin directly editing an existing event (see
// /api/events/[id]). Deliberately more lenient than eventSubmissionSchema:
// a curated listing (added via Prisma Studio or a backfill script, not
// through the public submission form) may never have had a website,
// division, team format, or gender category set, and an admin editing one
// other field shouldn't be forced to invent values for those just to save.
export const eventEditSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required"),
    date: z.coerce.date({ errorMap: () => ({ message: "Enter a valid start date" }) }),
    endDate: z.preprocess(emptyToUndefined, z.coerce.date({ errorMap: () => ({ message: "Enter a valid end date" }) }).optional()),
    isOnline: checkboxToBoolean,
    location: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    websiteUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Enter a valid website URL").optional()),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
    division: z.array(z.enum(EVENT_DIVISIONS)).optional().default([]),
    teamFormat: z.array(z.enum(EVENT_TEAM_FORMATS)).optional().default([]),
    genderCategory: z.array(z.enum(EVENT_GENDER_CATEGORIES)).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.isOnline && !data.location) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Location is required", path: ["location"] });
    }
    if (data.endDate && data.endDate < data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date can't be before the start date",
        path: ["endDate"],
      });
    }
  });

// The logo is a required upload, handled outside this schema (see
// /api/gyms/submit) the same way event/post/workout photos are.
export const gymSubmissionSchema = z.object({
  name: z.string().trim().min(1, "Affiliate name is required"),
  address: z.string().trim().min(1, "Address is required"),
  websiteUrl: z.string().trim().url("Enter a valid website URL"),
  description: z.string().trim().min(1, "Some information about the affiliate is required").max(2000),
});

// Used only by an admin directly editing an existing affiliate (see
// /api/gyms/[id]) — more lenient than gymSubmissionSchema, since a curated
// or manually-added row may never have had a website or description set.
export const gymEditSchema = z.object({
  name: z.string().trim().min(1, "Affiliate name is required"),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  websiteUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Enter a valid website URL").optional()),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});

// Who to invite to a private event — see src/lib/eventInvites.ts for how
// this gets resolved into actual user ids.
export const eventInviteAudienceSchema = z.object({
  userIds: z.array(z.string()).max(200).default([]),
  inviteFollowers: checkboxToBoolean,
  inviteAffiliateGym: z.preprocess(emptyToUndefined, z.string().trim().optional()),
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


export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
});

// Every field here narrows the audience further — all optional, and none
// selected means "everyone". Shared between the live "N people match" count
// (see /api/admin/notices/preview) and actually sending (/api/admin/notices).
export const noticeAudienceSchema = z.object({
  gender: z.preprocess(emptyToUndefined, z.enum(GENDERS).optional()),
  minAge: z.preprocess(emptyToUndefined, z.coerce.number().int().min(13).max(120).optional()),
  maxAge: z.preprocess(emptyToUndefined, z.coerce.number().int().min(13).max(120).optional()),
  level: z.preprocess(emptyToUndefined, z.enum(LEVELS).optional()),
  affiliateGym: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  country: z.preprocess(emptyToUndefined, z.enum(COUNTRIES).optional()),
  areaQuery: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  radiusMiles: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
});

export const noticeSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  body: z.string().trim().min(1, "Message is required").max(2000),
  audience: noticeAudienceSchema,
});
