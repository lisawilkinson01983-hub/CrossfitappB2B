// Comment/reply boxes default to a fixed number of rows with their own
// internal scrollbar, which hides the rest of what someone's typing once it
// overflows. Growing the box with the content instead keeps it all visible,
// capping out at MAX_HEIGHT so one huge paste can't blow up the page layout
// — past that point it scrolls internally like before.
const MAX_HEIGHT = 240;

/** Resizes a textarea to fit its content, up to MAX_HEIGHT. Safe to call with null (e.g. a ref that hasn't mounted yet). */
export function autoGrowTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  const next = Math.min(el.scrollHeight, MAX_HEIGHT);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
}
