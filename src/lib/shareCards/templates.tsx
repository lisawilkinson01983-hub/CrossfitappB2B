// Share-card templates for next/og's ImageResponse (Satori). Pixel values
// are kept at the same scale as the approved 270x480 mockups (see the
// Design canvas this was built from) and multiplied by SCALE at render time
// — change CARD_WIDTH/SCALE together if the target resolution ever changes.
export const CARD_WIDTH = 270;
export const CARD_HEIGHT = 480;

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
}: {
  photo: string | null;
  scale: number;
  gradient: string;
  objectPosition?: string;
}) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex" }}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          width={px(CARD_WIDTH, scale)}
          height={px(CARD_HEIGHT, scale)}
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

export type FeedStoryAProps = { name: string; photo: string | null; score: string; label: string };

export function FeedStoryA({ name, photo, score, label, scale }: FeedStoryAProps & { scale: number }) {
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
        gradient="linear-gradient(to top, #000 0%, #000 24%, rgba(0,0,0,0.75) 34%, rgba(0,0,0,0.25) 46%, transparent 58%)"
      />
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
            <div
              style={{
                marginTop: px(12, scale),
                fontSize: px(9, scale),
                lineHeight: 1.5,
                textAlign: "center",
                color: "rgba(255,255,255,0.55)",
                display: "flex",
              }}
            >
              {description}
            </div>
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
