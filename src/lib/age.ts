const MIN_AGE = 13;
const MAX_AGE = 120;

/** Age in whole years as of today — always current, since it's derived from the date of birth rather than stored. */
export function calculateAge(dateOfBirth: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dateOfBirth.getMonth() ||
    (now.getMonth() === dateOfBirth.getMonth() && now.getDate() >= dateOfBirth.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

export function isValidDateOfBirth(dateOfBirth: Date): boolean {
  if (Number.isNaN(dateOfBirth.getTime())) return false;
  const age = calculateAge(dateOfBirth);
  return age >= MIN_AGE && age <= MAX_AGE;
}

/**
 * Converts an admin-facing "between minAge and maxAge years old" filter into
 * the equivalent date-of-birth range to query on — e.g. "at least 18" means
 * born on or before today's date 18 years ago.
 */
export function ageRangeToDateOfBirthRange(
  minAge: number | undefined,
  maxAge: number | undefined
): { gte?: Date; lte?: Date } {
  const now = new Date();
  const range: { gte?: Date; lte?: Date } = {};
  // At most maxAge years old: not yet born before the day they'd turn maxAge+1.
  if (maxAge !== undefined) {
    const cutoff = new Date(now);
    cutoff.setFullYear(now.getFullYear() - (maxAge + 1));
    cutoff.setDate(cutoff.getDate() + 1);
    range.gte = cutoff;
  }
  // At least minAge years old: born on or before their minAge-th birthday.
  if (minAge !== undefined) {
    const cutoff = new Date(now);
    cutoff.setFullYear(now.getFullYear() - minAge);
    range.lte = cutoff;
  }
  return range;
}
