import affiliateGyms from "./affiliateGyms.json";

// The curated affiliate gyms, seeded with known public details from
// affiliateGyms.json (see gymPages.ts's ensureGymPage and
// scripts/backfill-gym-pages.js) and protected from renaming — see the
// name-lock in GymSubmitForm/the gym PATCH route. Any *approved* Gym row is
// selectable as a profile's affiliateGym, not just these — this list is no
// longer the source of truth for that dropdown.
export const AFFILIATE_GYMS: readonly string[] = affiliateGyms.map((gym) => gym.name);

// For people who haven't joined a gym yet (e.g. still finding out more).
export const UNAFFILIATED = "Unaffiliated";

// Selected when a gym isn't listed yet. The actual name they typed is kept
// separately (User.affiliateGymOther) rather than stored here.
export const OTHER_GYM = "Other";
