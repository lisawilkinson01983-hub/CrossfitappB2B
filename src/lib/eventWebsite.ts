export type EventPlatform = "aretas" | "competition-corner" | "circle21";

// Checked by hostname substring rather than an exact domain, so a regional
// subdomain (e.g. "uk.aretas.app") still matches. Used to show a badge for
// the registration platform on the event page.
const PLATFORM_HOSTNAME_MATCHES: [EventPlatform, string][] = [
  ["aretas", "aretas"],
  ["competition-corner", "competitioncorner"],
  ["circle21", "circle21"],
];

/** Which registration platform (if any) an event's website link points at. */
export function detectEventPlatform(url: string | null): EventPlatform | null {
  if (!url) return null;
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const match = PLATFORM_HOSTNAME_MATCHES.find(([, needle]) => hostname.includes(needle));
  return match ? match[0] : null;
}
