// Fixed list of local affiliate gyms shown as quick-pick options in the
// profile form and the Discover filter.
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
// separately (User.affiliateGymOther) rather than stored here, so this field
// stays a small fixed set of values and search stays exact and reliable.
export const OTHER_GYM = "Other";

// The full set of values User.affiliateGym can actually hold.
export const AFFILIATE_GYM_VALUES = [...AFFILIATE_GYMS, UNAFFILIATED, OTHER_GYM] as const;
export type AffiliateGymValue = (typeof AFFILIATE_GYM_VALUES)[number];

// What the profile form's dropdown shows before its final "Other" option.
export const GYM_OPTIONS = [...AFFILIATE_GYMS, UNAFFILIATED] as const;
