/**
 * Shared "does this fit?" check for teammate requests/alerts — "ANY" on
 * either side matches everything, same semantics used by the find-a-team
 * filter in EventNoticesPanel.
 */
export function teammateCriteriaMatch(
  a: { gender: string; division: string },
  b: { gender: string; division: string }
): boolean {
  const genderMatches = a.gender === "ANY" || b.gender === "ANY" || a.gender === b.gender;
  const divisionMatches = a.division === "ANY" || b.division === "ANY" || a.division === b.division;
  return genderMatches && divisionMatches;
}
