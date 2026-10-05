// Every date/time shown in the app goes through these, so they read the UK
// way ("28 Sept 2026", 24-hour times) regardless of the server's or the
// browser's own locale. The time zone is pinned too: server components render
// on a UTC host, so without it a UK user would see times an hour out during
// BST, and server- and client-rendered times could disagree.
export const APP_LOCALE = "en-GB";
export const APP_TIME_ZONE = "Europe/London";

type DateInput = Date | string | number;

/** A date on its own, e.g. "28/09/2026", or shaped by `options` (e.g. { month: "short", day: "numeric" } → "28 Sept"). */
export function formatDate(date: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(APP_LOCALE, { timeZone: APP_TIME_ZONE, ...options });
}

/** A time on its own, e.g. "08:05". */
export function formatTime(date: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleTimeString(APP_LOCALE, { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", ...options });
}

/** A date and time together, e.g. "28 Sept 2026, 08:05". */
export function formatDateTime(date: DateInput): string {
  return new Date(date).toLocaleString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
