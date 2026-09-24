// A handful of curated affiliate gyms, seeded with known public details (see
// gymPages.ts's KNOWN_GYM_INFO) and protected from renaming — see
// ensureGymPage and the name-lock in GymSubmitForm/the gym PATCH route.
// Any *approved* Gym row is selectable as a profile's affiliateGym, not just
// these — this list is no longer the source of truth for that dropdown.
export const AFFILIATE_GYMS = [
  "CrossFit Uckfield",
  "CrossFit Crowborough",
  "CrossFit Hailsham (FFH)",
  "CrossFit Burgess Hill (BYS)",
  "CrossFit Haywards Heath",
] as const;

// For people who haven't joined a gym yet (e.g. still finding out more).
export const UNAFFILIATED = "Unaffiliated";

// Selected when a gym isn't listed yet. The actual name they typed is kept
// separately (User.affiliateGymOther) rather than stored here.
export const OTHER_GYM = "Other";
