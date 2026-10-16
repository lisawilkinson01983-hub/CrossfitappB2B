// Pre-set options for the Competition Stats "Division" field (CrossFit
// Open and Community Cup results) — Men and Women kept as separate options
// throughout rather than combined ("Men and Women 35-39"), matching how an
// athlete actually picks one when registering. Division stays a plain
// string column either way (see OpenResult/CommunityCupResult in
// schema.prisma); this is just what the dropdown offers before falling
// back to free text.
export const COMPETITION_DIVISIONS: readonly string[] = [
  "Women",
  "Men",
  "Girls 14-15",
  "Boys 14-15",
  "Girls 16-17",
  "Boys 16-17",
  "Women 35-39",
  "Men 35-39",
  "Women 40-44",
  "Men 40-44",
  "Women 45-49",
  "Men 45-49",
  "Women 50-54",
  "Men 50-54",
  "Women 55-59",
  "Men 55-59",
  "Women 60-64",
  "Men 60-64",
  "Women 65-69",
  "Men 65-69",
  "Women 70+",
  "Men 70+",
];

// Selected when a division isn't in the preset list — same "Other, type
// your own" pattern as OTHER_GYM (see src/lib/gyms.ts).
export const OTHER_DIVISION = "Other";
