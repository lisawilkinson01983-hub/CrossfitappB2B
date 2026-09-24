/** Formats an event's date, showing a range (e.g. "Oct 4 – Oct 6, 2026") when endDate is set and differs from date. */
export function formatEventDate(event: { date: Date; endDate: Date | null }): string {
  const { date, endDate } = event;
  const isRange = endDate && endDate.toDateString() !== date.toDateString();

  if (!isRange) {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const startStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endStr = endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

/** The date used to decide whether an event has already finished — endDate if set, otherwise date. */
export function eventEffectiveEndDate(event: { date: Date; endDate: Date | null }): Date {
  return event.endDate ?? event.date;
}
