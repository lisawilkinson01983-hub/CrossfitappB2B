/**
 * The app's own public base URL — for absolute links (OG tags, emails)
 * built server-side, where there's no `window.location` to read from.
 * Falls back to localhost for local dev, same as the forgot-password email
 * already does.
 */
export function appUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}
