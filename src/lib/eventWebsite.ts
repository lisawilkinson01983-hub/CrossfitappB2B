/**
 * Whether an event's registration link points at Aretas (the competition
 * registration platform) — checked by hostname rather than an exact domain
 * so it still matches a regional subdomain (e.g. "uk.aretas.app"). Used to
 * show the "Aretas Event" badge on the event page.
 */
export function isAretasUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase().includes("aretas");
  } catch {
    return false;
  }
}
