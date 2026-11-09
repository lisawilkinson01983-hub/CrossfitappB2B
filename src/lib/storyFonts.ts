/**
 * The curated font choices offered on a text box in the story editor (see
 * StoryEditor). Loaded independently of this app's own next/font instances
 * (which expose obfuscated internal family names, not usable from
 * ctx.font) via a dynamically-injected Google Fonts stylesheet — see
 * ensureStoryFontsLoaded — so the exact same family name works both for the
 * on-screen text box (inline style) and the flattened canvas export.
 */
export const STORY_FONTS = [
  { key: "inter", label: "Sans", family: "Inter", cssWeight: 700, googleSpec: "Inter:wght@400;700;800" },
  { key: "bebas", label: "Display", family: "Bebas Neue", cssWeight: 400, googleSpec: "Bebas+Neue" },
  { key: "caveat", label: "Script", family: "Caveat", cssWeight: 700, googleSpec: "Caveat:wght@700" },
  { key: "oswald", label: "Bold", family: "Oswald", cssWeight: 700, googleSpec: "Oswald:wght@700" },
] as const;

export type StoryFontKey = (typeof STORY_FONTS)[number]["key"];

export function storyFontByKey(key: StoryFontKey) {
  return STORY_FONTS.find((f) => f.key === key) ?? STORY_FONTS[0];
}

let loaded: Promise<void> | null = null;

/** Injects the Google Fonts stylesheet for every STORY_FONTS family (once) and resolves once they're actually usable — including by a <canvas> 2D context, which only honors a font once document.fonts reports it ready. */
export function ensureStoryFontsLoaded(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    if (typeof document === "undefined") return;
    const existing = document.getElementById("story-fonts-link");
    if (!existing) {
      const link = document.createElement("link");
      link.id = "story-fonts-link";
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?${STORY_FONTS.map((f) => `family=${f.googleSpec}`).join("&")}&display=swap`;
      document.head.appendChild(link);
    }
    await Promise.all(
      STORY_FONTS.map((f) => document.fonts.load(`${f.cssWeight} 48px "${f.family}"`).catch(() => {}))
    );
    await document.fonts.ready;
  })();
  return loaded;
}
