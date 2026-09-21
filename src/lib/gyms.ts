// Fixed list of local affiliate gyms shown as quick-pick options in the
// profile form and the Discover filter. "Other" (profile form only) lets
// someone whose gym isn't listed yet type it in instead.
export const AFFILIATE_GYMS = [
  "CrossFit Uckfield",
  "CrossFit Crowborough",
  "CrossFit Hailsham (FFH)",
  "CrossFit Burgess Hill (BYS)",
] as const;

// For people who haven't joined a gym yet (e.g. still finding out more).
export const UNAFFILIATED = "Unaffiliated";

// The full set of selectable options before "Other" — gyms plus the
// not-yet-affiliated case, shown together in both the profile form and the
// Discover filter.
export const GYM_OPTIONS = [...AFFILIATE_GYMS, UNAFFILIATED] as const;
