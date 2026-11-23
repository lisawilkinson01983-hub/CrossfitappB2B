// Share-card templates for next/og's ImageResponse (Satori). Pixel values
// are kept at the same scale as the approved 270x480 mockups (see the
// Design canvas this was built from) and multiplied by SCALE at render time
// — change CARD_WIDTH/SCALE together if the target resolution ever changes.
import type { CSSProperties } from "react";

export const CARD_WIDTH = 270;
export const CARD_HEIGHT = 480;
// The feed's own square card format (see FeedPostA/FeedPostC below) — same
// width as the 9:16 story card, just a square frame instead, since a full
// story-height card was taking up far too much of the feed.
export const SQUARE_CARD_HEIGHT = CARD_WIDTH;

// FeedStoryA's (tall) and FeedPostA's (square) own bottom-darkening gradient
// over the full-bleed photo, named so the photo-swap crop step (see
// AvatarCropper's textGuide prop, wired up in ShareSheet) can paint the
// exact same gradient over the crop preview — showing where the card's own
// text is actually going to land before it's baked in for good.
export const PHOTO_OVERLAY_GRADIENTS = {
  story: "linear-gradient(to top, #000 0%, #000 24%, rgba(0,0,0,0.75) 34%, rgba(0,0,0,0.25) 46%, transparent 58%)",
  feed: "linear-gradient(to top, #000 0%, #000 20%, rgba(0,0,0,0.78) 32%, rgba(0,0,0,0.3) 48%, transparent 62%)",
};

export const COLORS = {
  bg: "#e9e6df",
  ink: "#232223",
  gold: "#b8842a",
  charcoal: "#4a4a4a",
  darkest: "#1a1918",
};

export type ShareCardFormat = "A" | "B" | "C";

function px(n: number, scale: number) {
  return Math.round(n * scale);
}

// Inline SVG rather than the 🏆 emoji character — Satori/next/og resolves
// emoji glyphs by fetching them from an external CDN at render time (see
// next/og's `emoji` option), which both adds a point of failure to every
// share-image request and doesn't work at all from a network-restricted
// environment (confirmed: ENOTFOUND cdn.jsdelivr.net in this sandbox).
function TrophyIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ display: "flex" }}
    >
      <path
        fill={color}
        d="M19 3h-2V2H7v1H5a3 3 0 0 0-3 3v2a4 4 0 0 0 4 4 6.002 6.002 0 0 0 5 4.584V18H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.416A6.002 6.002 0 0 0 18 12a4 4 0 0 0 4-4V6a3 3 0 0 0-3-3zM4 8V6a1 1 0 0 1 1-1h2v4a3.969 3.969 0 0 0 .102 1A2.002 2.002 0 0 1 4 8zm16 0a2.002 2.002 0 0 1-2.102 2A3.969 3.969 0 0 0 18 9V5h2a1 1 0 0 1 1 1z"
      />
    </svg>
  );
}

// Same reasoning as TrophyIcon: the Inter subset bundled here has no glyph
// for U+25B2 (▲), so it rendered as a missing-glyph box — a plain filled
// triangle drawn as SVG instead.
function UpTriangleIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "flex" }}>
      <path fill={color} d="M12 3 L22 20 L2 20 Z" />
    </svg>
  );
}

/** The "box2box"/"box2box.social" wordmark footer — identical across every card. */
function Footer({
  scale,
  dark,
  domain,
  inset,
}: {
  scale: number;
  /** true = white text (on a dark card), false = charcoal (on a light card) */
  dark: boolean;
  domain?: boolean;
  /** Use when the footer sits inside an inner card rather than floating absolutely over the outer background. */
  inset?: boolean;
}) {
  const textStyle = {
    fontSize: px(14, scale),
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: dark ? "#fff" : COLORS.ink,
    display: "flex",
  };
  const content = (
    <div style={textStyle}>
      {domain ? "via box" : "box"}
      <span style={{ color: COLORS.gold, display: "flex" }}>2</span>
      {domain ? "box.social" : "box"}
    </div>
  );
  if (inset) {
    return (
      <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
        {content}
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: px(14, scale),
        display: "flex",
        justifyContent: "center",
      }}
    >
      {content}
    </div>
  );
}

function PhotoLayer({
  photo,
  scale,
  gradient,
  objectPosition = "50% 30%",
  height = CARD_HEIGHT,
}: {
  photo: string | null;
  scale: number;
  gradient: string;
  objectPosition?: string;
  /** Defaults to the 9:16 story card's height — the square feed cards below pass SQUARE_CARD_HEIGHT instead. */
  height?: number;
}) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex" }}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          width={px(CARD_WIDTH, scale)}
          height={px(height, scale)}
          style={{ position: "absolute", top: 0, left: 0, objectFit: "cover", objectPosition }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: gradient,
          display: "flex",
        }}
      />
    </div>
  );
}

/**
 * A free-text workout description (typed into a multi-line textarea) often
 * carries real "\n" line breaks. Handing the whole string to a single
 * `flexWrap` text node — the normal fix for Satori not knowing where to
 * wrap — mixes those hard breaks with Satori's own word-wrapping and
 * renders adjacent lines on top of each other instead of stacked, exactly
 * the overlap this is meant to fix. Splitting on "\n" ourselves and giving
 * each line its own flexWrap row sidesteps that entirely: a hard break and
 * a word-wrapped break end up with identical, correct line spacing, since
 * each row is just as tall as its own (possibly wrapped) content.
 */
function MultiLineText({ text, style }: { text: string; style: CSSProperties }) {
  const { marginTop, width, ...lineStyle } = style;
  return (
    <div style={{ display: "flex", flexDirection: "column", width, marginTop }}>
      {text.split("\n").map((line, i) => (
        <div key={i} style={{ ...lineStyle, width, display: "flex", flexWrap: "wrap" }}>
          {line}
        </div>
      ))}
    </div>
  );
}

export type FeedStoryAProps = {
  name: string;
  photo: string | null;
  score: string;
  label: string;
  description: string | null;
  wodName: string;
};

export function FeedStoryA({ name, photo, score, label, description, scale }: FeedStoryAProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.darkest,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      <PhotoLayer photo={photo} scale={scale} gradient={PHOTO_OVERLAY_GRADIENTS.story} />
      <div
        style={{
          position: "absolute",
          left: px(16, scale),
          right: px(16, scale),
          bottom: px(48, scale),
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: px(12, scale), fontWeight: 700, display: "flex" }}>{name}</div>
        <div
          style={{
            fontFamily: "Bebas Neue",
            fontSize: px(46, scale),
            lineHeight: 0.95,
            marginTop: px(4, scale),
            display: "flex",
          }}
        >
          {score}
        </div>
        <div
          style={{
            fontSize: px(12, scale),
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.8)",
            marginTop: px(2, scale),
            display: "flex",
          }}
        >
          {label}
        </div>
        {description && (
          <MultiLineText
            text={description}
            style={{
              width: px(CARD_WIDTH - 32, scale),
              marginTop: px(8, scale),
              fontSize: px(11, scale),
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.7)",
            }}
          />
        )}
      </div>
      <Footer scale={scale} dark domain />
    </div>
  );
}

export type FeedStoryBProps = { name: string; photo: string | null; quote: string };

export function FeedStoryB({ name, photo, quote, scale }: FeedStoryBProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.ink,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: px(2, scale), background: COLORS.gold, display: "flex" }} />
      <div
        style={{
          position: "absolute",
          left: px(16, scale),
          top: px(28, scale),
          display: "flex",
          alignItems: "center",
          gap: px(7, scale),
        }}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            width={px(22, scale)}
            height={px(22, scale)}
            style={{ borderRadius: 999, objectFit: "cover", objectPosition: "50% 20%" }}
          />
        )}
        <div style={{ fontSize: px(12, scale), fontWeight: 700, display: "flex" }}>{name}</div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: `0 ${px(26, scale)}px`,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "Bebas Neue", fontSize: px(54, scale), lineHeight: 0.8, color: "rgba(184,132,42,0.35)", display: "flex" }}>
          &ldquo;
        </div>
        <div
          style={{
            width: px(CARD_WIDTH - 52, scale),
            marginTop: px(6, scale),
            fontSize: px(19, scale),
            fontWeight: 700,
            lineHeight: 1.35,
            textAlign: "center",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {quote}
        </div>
      </div>
      <Footer scale={scale} dark domain />
    </div>
  );
}

export type FeedStoryCProps = {
  name: string;
  photo: string | null;
  date: string;
  scoreLabel: string;
  score: string;
  badge: string;
  description: string | null;
  wodName: string;
  stats: { value: string; label: string }[];
};

export function FeedStoryC({ name, photo, date, scoreLabel, score, badge, description, stats, scale }: FeedStoryCProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.bg,
        color: COLORS.ink,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: px(24, scale),
          right: px(24, scale),
          top: px(32, scale),
          bottom: px(32, scale),
          borderRadius: px(18, scale),
          background: COLORS.ink,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: `${px(18, scale)}px ${px(16, scale)}px 0`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: px(6, scale) }}>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                width={px(20, scale)}
                height={px(20, scale)}
                style={{ borderRadius: 999, objectFit: "cover", objectPosition: "50% 20%" }}
              />
            )}
            <div style={{ fontSize: px(11, scale), fontWeight: 600, display: "flex" }}>{name}</div>
          </div>
          <div style={{ fontSize: px(9, scale), color: "rgba(255,255,255,0.4)", display: "flex" }}>{date}</div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: `0 ${px(16, scale)}px`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: px(10, scale),
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: COLORS.gold,
              display: "flex",
            }}
          >
            {scoreLabel}
          </div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: px(50, scale), lineHeight: 0.9, marginTop: px(4, scale), display: "flex" }}>
            {score}
          </div>
          <div
            style={{
              marginTop: px(10, scale),
              background: "rgba(184,132,42,0.15)",
              color: COLORS.gold,
              fontSize: px(9, scale),
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: `${px(3, scale)}px ${px(10, scale)}px`,
              borderRadius: 999,
              display: "flex",
            }}
          >
            {badge}
          </div>
          {description && (
            <MultiLineText
              text={description}
              style={{
                width: px(CARD_WIDTH - 48 - 32, scale),
                marginTop: px(12, scale),
                fontSize: px(9, scale),
                lineHeight: 1.5,
                textAlign: "center",
                color: "rgba(255,255,255,0.55)",
                justifyContent: "center",
              }}
            />
          )}
        </div>

        {stats.length > 0 && (
          <div
            style={{
              padding: `${px(12, scale)}px ${px(16, scale)}px ${px(16, scale)}px`,
              margin: `0 ${px(16, scale)}px ${px(16, scale)}px`,
              display: "flex",
              justifyContent: "space-around",
              borderTop: `${px(1, scale)}px solid rgba(255,255,255,0.1)`,
            }}
          >
            {stats.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: px(13, scale), fontWeight: 700, display: "flex" }}>{s.value}</div>
                <div
                  style={{
                    marginTop: px(2, scale),
                    fontSize: px(8, scale),
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ paddingBottom: px(14, scale), display: "flex", justifyContent: "center" }}>
          <Footer scale={scale} dark inset />
        </div>
      </div>
    </div>
  );
}

/**
 * Square (1:1) counterparts to FeedStoryA/FeedStoryC above, used only when
 * a workout is shared to the Feed (see /api/share/workout/image's `layout`
 * param) — Story and Instagram keep the full 9:16 card. Same content, same
 * CARD_WIDTH, just reflowed into SQUARE_CARD_HEIGHT with tighter type and
 * spacing; no room left for the optional description either format can
 * carry, so it's accepted (same prop types) but not rendered here.
 */
export function FeedPostA({ name, photo, score, label, wodName, scale }: FeedStoryAProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(SQUARE_CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.darkest,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      <PhotoLayer photo={photo} scale={scale} height={SQUARE_CARD_HEIGHT} gradient={PHOTO_OVERLAY_GRADIENTS.feed} />
      <div
        style={{
          position: "absolute",
          left: px(14, scale),
          right: px(14, scale),
          // Same clearance above the footer as FeedStoryA's own 48-vs-14 —
          // Footer is always anchored at bottom:14 regardless of card
          // height, so the gap this needs is fixed, not proportional to
          // the (now much shorter) card.
          bottom: px(48, scale),
          display: "flex",
          flexDirection: "column",
        }}
      >
        {wodName && (
          <div
            style={{
              fontSize: px(10, scale),
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.65)",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {wodName}
          </div>
        )}
        <div style={{ fontSize: px(11, scale), fontWeight: 700, marginTop: px(2, scale), display: "flex" }}>{name}</div>
        <div
          style={{
            fontFamily: "Bebas Neue",
            fontSize: px(36, scale),
            lineHeight: 0.95,
            marginTop: px(2, scale),
            display: "flex",
          }}
        >
          {score}
        </div>
        <div
          style={{
            fontSize: px(10, scale),
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.8)",
            marginTop: px(1, scale),
            display: "flex",
          }}
        >
          {label}
        </div>
      </div>
      <Footer scale={scale} dark domain />
    </div>
  );
}

export function FeedPostC({ name, photo, date, scoreLabel, score, badge, wodName, stats, scale }: FeedStoryCProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(SQUARE_CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.bg,
        color: COLORS.ink,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: px(12, scale),
          right: px(12, scale),
          top: px(12, scale),
          bottom: px(12, scale),
          borderRadius: px(16, scale),
          background: COLORS.ink,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: `${px(12, scale)}px ${px(14, scale)}px 0`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: px(5, scale) }}>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                width={px(16, scale)}
                height={px(16, scale)}
                style={{ borderRadius: 999, objectFit: "cover", objectPosition: "50% 20%" }}
              />
            )}
            <div style={{ fontSize: px(10, scale), fontWeight: 600, display: "flex" }}>{name}</div>
          </div>
          <div style={{ fontSize: px(8, scale), color: "rgba(255,255,255,0.4)", display: "flex" }}>{date}</div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: `0 ${px(14, scale)}px`,
            textAlign: "center",
          }}
        >
          {wodName && (
            <div
              style={{
                fontSize: px(13, scale),
                fontWeight: 700,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {wodName}
            </div>
          )}
          <div
            style={{
              fontSize: px(9, scale),
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.gold,
              marginTop: wodName ? px(6, scale) : 0,
              display: "flex",
            }}
          >
            {scoreLabel}
          </div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: px(34, scale), lineHeight: 0.9, marginTop: px(2, scale), display: "flex" }}>
            {score}
          </div>
          <div
            style={{
              marginTop: px(6, scale),
              background: "rgba(184,132,42,0.15)",
              color: COLORS.gold,
              fontSize: px(8, scale),
              fontWeight: 800,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: `${px(2, scale)}px ${px(8, scale)}px`,
              borderRadius: 999,
              display: "flex",
            }}
          >
            {badge}
          </div>
        </div>

        {stats.length > 0 && (
          <div
            style={{
              padding: `${px(8, scale)}px ${px(14, scale)}px ${px(10, scale)}px`,
              margin: `0 ${px(12, scale)}px ${px(10, scale)}px`,
              display: "flex",
              justifyContent: "space-around",
              borderTop: `${px(1, scale)}px solid rgba(255,255,255,0.1)`,
            }}
          >
            {stats.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: px(12, scale), fontWeight: 700, display: "flex" }}>{s.value}</div>
                <div
                  style={{
                    marginTop: px(1, scale),
                    fontSize: px(7, scale),
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    display: "flex",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ paddingBottom: px(10, scale), display: "flex", justifyContent: "center" }}>
          <Footer scale={scale} dark inset />
        </div>
      </div>
    </div>
  );
}

export type PbCardAProps = { name: string; photo: string | null; fieldLabel: string; value: string; unit: string };

export function PbCardA({ name, photo, fieldLabel, value, unit, scale }: PbCardAProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.ink,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(184,132,42,0.14) 0px, rgba(184,132,42,0.14) 2px, transparent 2px, transparent 20px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: px(6, scale),
            color: COLORS.gold,
            fontSize: px(19, scale),
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <TrophyIcon size={px(18, scale)} color={COLORS.gold} />
          New PB
        </div>
        <div
          style={{
            marginTop: px(16, scale),
            width: px(92, scale),
            height: px(92, scale),
            borderRadius: 999,
            display: "flex",
            overflow: "hidden",
            border: `${px(3, scale)}px solid ${COLORS.gold}`,
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              width={px(92, scale)}
              height={px(92, scale)}
              style={{ objectFit: "cover", objectPosition: "50% 20%" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: COLORS.charcoal, display: "flex" }} />
          )}
        </div>
        <div style={{ marginTop: px(18, scale), fontFamily: "Bebas Neue", fontSize: px(56, scale), lineHeight: 0.9, display: "flex" }}>
          {value}
          <span style={{ fontSize: px(24, scale), display: "flex" }}>{unit}</span>
        </div>
        <div
          style={{
            marginTop: px(4, scale),
            fontSize: px(12, scale),
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.75)",
            display: "flex",
          }}
        >
          {fieldLabel}
        </div>
        <div style={{ marginTop: px(14, scale), fontSize: px(10, scale), fontWeight: 600, color: COLORS.gold, display: "flex" }}>
          {name}
        </div>
      </div>
      <Footer scale={scale} dark />
    </div>
  );
}

export type PbCardBProps = {
  name: string;
  photo: string | null;
  fieldLabel: string;
  value: string;
  unit: string;
  delta: string | null;
  previous: string | null;
};

export function PbCardB({ name, photo, fieldLabel, value, unit, delta, previous, scale }: PbCardBProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.bg,
        color: COLORS.ink,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: px(24, scale),
          right: px(24, scale),
          top: px(32, scale),
          bottom: px(32, scale),
          borderRadius: px(20, scale),
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: `${px(26, scale)}px ${px(18, scale)}px ${px(16, scale)}px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: px(8, scale), alignSelf: "flex-start" }}>
          <div
            style={{
              width: px(30, scale),
              height: px(30, scale),
              borderRadius: 999,
              display: "flex",
              overflow: "hidden",
              border: `${px(2, scale)}px solid ${COLORS.gold}`,
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                width={px(30, scale)}
                height={px(30, scale)}
                style={{ objectFit: "cover", objectPosition: "50% 20%" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", background: COLORS.charcoal, display: "flex" }} />
            )}
          </div>
          <div style={{ fontSize: px(11, scale), fontWeight: 700, display: "flex" }}>{name}</div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              color: COLORS.gold,
              fontSize: px(19, scale),
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: px(10, scale),
              display: "flex",
            }}
          >
            New PB
          </div>
          <div
            style={{
              fontSize: px(10, scale),
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(35,34,35,0.45)",
              display: "flex",
            }}
          >
            {fieldLabel}
          </div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: px(58, scale), lineHeight: 0.9, color: COLORS.ink, marginTop: px(2, scale), display: "flex" }}>
            {value}
            <span style={{ fontSize: px(24, scale), display: "flex" }}>{unit}</span>
          </div>
          {delta && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: px(3, scale),
                marginTop: px(10, scale),
                background: "rgba(184,132,42,0.12)",
                color: "#96691f",
                fontSize: px(11, scale),
                fontWeight: 800,
                padding: `${px(4, scale)}px ${px(10, scale)}px`,
                borderRadius: 999,
              }}
            >
              <UpTriangleIcon size={px(9, scale)} color="#96691f" />
              {delta}
            </div>
          )}
          {previous && (
            <div style={{ marginTop: px(8, scale), fontSize: px(9, scale), color: "rgba(35,34,35,0.4)", display: "flex" }}>
              was {previous}
            </div>
          )}
        </div>

        <Footer scale={scale} dark={false} inset />
      </div>
    </div>
  );
}

export type PbCardCProps = { photo: string | null; fieldLabel: string; value: string; unit: string };

export function PbCardC({ photo, fieldLabel, value, unit, scale }: PbCardCProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.charcoal,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      <PhotoLayer
        photo={photo}
        scale={scale}
        objectPosition="50% 20%"
        gradient="linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%), linear-gradient(to top, #000 0%, rgba(0,0,0,0.9) 22%, rgba(0,0,0,0.55) 36%, transparent 52%)"
      />
      <div
        style={{
          position: "absolute",
          left: px(18, scale),
          right: px(18, scale),
          bottom: px(46, scale),
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: px(5, scale),
            color: COLORS.gold,
            fontSize: px(17, scale),
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <TrophyIcon size={px(16, scale)} color={COLORS.gold} />
          New PB
        </div>
        <div style={{ fontFamily: "Bebas Neue", fontSize: px(44, scale), lineHeight: 0.95, marginTop: px(10, scale), display: "flex" }}>
          {fieldLabel}
        </div>
        <div style={{ fontSize: px(22, scale), fontWeight: 700, marginTop: px(2, scale), display: "flex" }}>
          {value}
          <span style={{ fontSize: px(13, scale), fontWeight: 600, display: "flex" }}>{unit}</span>
        </div>
      </div>
      <Footer scale={scale} dark />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Shared by the three Result-card formats (a competition result has no
// score/label of its own the way a workout post does — see
// src/lib/shareCards/postData.ts). `headline` and `competitorsLine` come
// pre-formatted from src/lib/eventResults.ts (resultHeadline etc.) so these
// templates don't need to know about placement/placementType themselves.
// Also reused for an "attending"/event-join share, which has no
// division/placement of its own — see loadFeedStoryData for how each field
// gets repurposed there, and badgeLabel for the pill text override.
export type ResultCardProps = {
  name: string;
  photo: string | null;
  headline: string;
  competitorsLine: string | null;
  eventName: string | null;
  divisionLocation: string | null;
  /** Small pill above the headline. Defaults per format below ("Result"/"Competition Result") when unset. */
  badgeLabel?: string;
  /** First names of the roster, registered teammates and freeform (not-on-the-app) names alike — set only for a team result, so these templates can print who was actually on the team next to its name instead of just the team name alone. */
  teamMembers?: string[] | null;
};

export function ResultCardA({ name, photo, headline, competitorsLine, eventName, divisionLocation, badgeLabel, teamMembers, scale }: ResultCardProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.darkest,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      <PhotoLayer
        photo={photo}
        scale={scale}
        // Taller than FeedStoryA's — this card's bottom text block can grow
        // to 3+ lines (a long event name wrapping, plus a note line, see
        // loadFeedStoryData's "attending" case) where a result's headline
        // never used to, so the dark area needs more headroom to still
        // read against a bright photo.
        gradient="linear-gradient(to top, #000 0%, #000 30%, rgba(0,0,0,0.75) 42%, rgba(0,0,0,0.25) 56%, transparent 70%)"
      />
      <div
        style={{
          position: "absolute",
          left: px(16, scale),
          top: px(16, scale),
          display: "flex",
          alignItems: "center",
          gap: px(5, scale),
          background: COLORS.gold,
          borderRadius: 999,
          padding: `${px(6, scale)}px ${px(12, scale)}px ${px(6, scale)}px ${px(9, scale)}px`,
        }}
      >
        <TrophyIcon size={px(14, scale)} color="#fff" />
        <div style={{ fontSize: px(11, scale), fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", display: "flex" }}>
          {badgeLabel ?? "Result"}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: px(16, scale),
          right: px(16, scale),
          bottom: px(48, scale),
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: px(12, scale), fontWeight: 700, display: "flex" }}>{name}</div>
        {teamMembers && teamMembers.length > 0 && (
          <div
            style={{
              width: px(CARD_WIDTH - 32, scale),
              fontSize: px(10, scale),
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              marginTop: px(1, scale),
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            with {teamMembers.join(", ")}
          </div>
        )}
        <MultiLineText
          text={headline}
          style={{ width: px(CARD_WIDTH - 32, scale), fontFamily: "Bebas Neue", fontSize: px(44, scale), lineHeight: 1, marginTop: px(4, scale) }}
        />
        {competitorsLine && (
          <div
            style={{
              width: px(CARD_WIDTH - 32, scale),
              fontSize: px(12, scale),
              fontWeight: 600,
              color: "rgba(255,255,255,0.65)",
              marginTop: px(2, scale),
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {competitorsLine}
          </div>
        )}
        {eventName && (
          <div
            style={{
              width: px(CARD_WIDTH - 32, scale),
              fontSize: px(13, scale),
              fontWeight: 700,
              marginTop: px(10, scale),
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {eventName}
          </div>
        )}
        {divisionLocation && (
          <div style={{ fontSize: px(11, scale), color: "rgba(255,255,255,0.75)", marginTop: px(2, scale), display: "flex" }}>
            {divisionLocation}
          </div>
        )}
      </div>
      <Footer scale={scale} dark domain />
    </div>
  );
}

export type ResultCardBProps = ResultCardProps & { accent: string; pattern: "stripes" | "solid" };

export function ResultCardB({ name, headline, competitorsLine, eventName, divisionLocation, accent, pattern, badgeLabel, teamMembers, scale }: ResultCardBProps & { scale: number }) {
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.ink,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      {pattern === "stripes" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage: `repeating-linear-gradient(135deg, ${hexToRgba(accent, 0.14)} 0px, ${hexToRgba(accent, 0.14)} 2px, transparent 2px, transparent 20px)`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: px(6, scale),
            color: accent,
            fontSize: px(17, scale),
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <TrophyIcon size={px(16, scale)} color={accent} />
          {badgeLabel ?? "Result"}
        </div>
        <MultiLineText
          text={headline}
          style={{
            marginTop: px(16, scale),
            width: px(CARD_WIDTH - 48, scale),
            fontFamily: "Bebas Neue",
            fontSize: px(42, scale),
            lineHeight: 1,
            textAlign: "center",
            justifyContent: "center",
          }}
        />
        {competitorsLine && (
          <div
            style={{
              marginTop: px(4, scale),
              width: px(CARD_WIDTH - 48, scale),
              fontSize: px(11, scale),
              fontWeight: 600,
              color: "rgba(255,255,255,0.55)",
              textAlign: "center",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {competitorsLine}
          </div>
        )}
        <div style={{ marginTop: px(14, scale), width: px(32, scale), height: px(1, scale) || 1, background: accent, display: "flex" }} />
        {eventName && (
          <div
            style={{
              marginTop: px(14, scale),
              width: px(CARD_WIDTH - 48, scale),
              fontSize: px(13, scale),
              fontWeight: 700,
              textAlign: "center",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {eventName}
          </div>
        )}
        {divisionLocation && (
          <div style={{ marginTop: px(3, scale), fontSize: px(10, scale), color: "rgba(255,255,255,0.6)", display: "flex" }}>{divisionLocation}</div>
        )}
        <div
          style={{
            marginTop: px(10, scale),
            fontSize: px(10, scale),
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: accent,
            display: "flex",
          }}
        >
          {name}
        </div>
        {teamMembers && teamMembers.length > 0 && (
          <div
            style={{
              marginTop: px(2, scale),
              width: px(CARD_WIDTH - 48, scale),
              fontSize: px(10, scale),
              color: "rgba(255,255,255,0.55)",
              textAlign: "center",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            with {teamMembers.join(", ")}
          </div>
        )}
      </div>
      <Footer scale={scale} dark />
    </div>
  );
}

export function ResultCardC({ name, photo, headline, competitorsLine, eventName, divisionLocation, badgeLabel, teamMembers, scale }: ResultCardProps & { scale: number }) {
  const medallionSize = 84;
  return (
    <div
      style={{
        width: px(CARD_WIDTH, scale),
        height: px(CARD_HEIGHT, scale),
        position: "relative",
        display: "flex",
        background: COLORS.bg,
        color: COLORS.ink,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: px(8, scale),
          left: px(8, scale),
          right: px(8, scale),
          bottom: px(8, scale),
          border: `${px(1, scale)}px solid rgba(184,132,42,0.55)`,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: px(38, scale),
        }}
      >
        <div style={{ fontSize: px(9, scale), fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(35,34,35,0.45)", display: "flex" }}>
          {badgeLabel ?? "Competition Result"}
        </div>
        <div
          style={{
            marginTop: px(14, scale),
            width: px(medallionSize, scale),
            height: px(medallionSize, scale),
            borderRadius: 999,
            overflow: "hidden",
            border: `${px(3, scale)}px solid ${COLORS.gold}`,
            display: "flex",
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              width={px(medallionSize, scale)}
              height={px(medallionSize, scale)}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(160deg, ${COLORS.charcoal}, ${COLORS.darkest})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrophyIcon size={px(30, scale)} color={COLORS.gold} />
            </div>
          )}
        </div>
        <MultiLineText
          text={headline}
          style={{
            marginTop: px(16, scale),
            width: px(CARD_WIDTH - 44, scale),
            fontFamily: "Bebas Neue",
            fontSize: px(46, scale),
            lineHeight: 1,
            textAlign: "center",
            justifyContent: "center",
          }}
        />
        {competitorsLine && (
          <div
            style={{
              marginTop: px(3, scale),
              width: px(CARD_WIDTH - 44, scale),
              fontSize: px(10, scale),
              fontWeight: 600,
              color: "rgba(35,34,35,0.5)",
              textAlign: "center",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {competitorsLine}
          </div>
        )}
        <div
          style={{
            marginTop: px(12, scale),
            fontSize: px(9, scale),
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COLORS.gold,
            display: "flex",
          }}
        >
          {name}
        </div>
        {teamMembers && teamMembers.length > 0 && (
          <div
            style={{
              marginTop: px(2, scale),
              width: px(CARD_WIDTH - 44, scale),
              fontSize: px(9, scale),
              color: "rgba(35,34,35,0.55)",
              textAlign: "center",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            with {teamMembers.join(", ")}
          </div>
        )}
        {eventName && (
          <div
            style={{
              marginTop: px(10, scale),
              width: px(CARD_WIDTH - 44, scale),
              fontSize: px(13, scale),
              fontWeight: 700,
              textAlign: "center",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {eventName}
          </div>
        )}
        {divisionLocation && (
          <div style={{ marginTop: px(2, scale), fontSize: px(9, scale), color: "rgba(35,34,35,0.55)", display: "flex" }}>{divisionLocation}</div>
        )}
      </div>
      <Footer scale={scale} dark={false} />
    </div>
  );
}
