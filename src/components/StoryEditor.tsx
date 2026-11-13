"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ensureStoryFontsLoaded, STORY_FONTS, storyFontByKey, type StoryFontKey } from "@/lib/storyFonts";
import { STORY_BACKGROUND_COLORS } from "@/lib/stories";

// True Instagram Story resolution — every percentage-based text box
// position/size is scaled up to this for the flattened export, regardless
// of how small the on-screen editor itself renders.
const OUTPUT_W = 1080;
const OUTPUT_H = 1920;

const TEXT_COLORS = ["#ffffff", "#232223", "#b8842a", "#ef4444", "#1d4ed8", "#047857"];
const BG_SWATCHES = [...STORY_BACKGROUND_COLORS, "#ffffff", "#000000"];
const BORDER_COLORS = ["#ffffff", "#232223", "#b8842a"];

// How close the box's center has to come to the canvas's own horizontal/
// vertical center (in % of that axis) before it snaps there and the guide
// line lights up — same idea as Instagram/Canva's center-snap.
const SNAP_THRESHOLD_PCT = 2.5;
const MIN_WIDTH_PCT = 20;
const MAX_WIDTH_PCT = 94;

export type StoryBase = { kind: "color" } | { kind: "photo"; file: File } | { kind: "video"; file: File };
export type TextAlign = "left" | "center" | "right";

type TextBox = {
  id: string;
  text: string;
  xPct: number; // center position, 0-100
  yPct: number;
  widthPct: number; // box width as a % of the output width — set by the two-finger resize gesture; height always just follows the wrapped text
  fontKey: StoryFontKey;
  color: string;
  align: TextAlign;
  bgColor: string | null; // null = fully transparent
  bgOpacity: number; // 0-1, only meaningful when bgColor is set
  borderColor: string | null; // null = no border
  sizePct: number; // font size as a % of the output height
};

export type StoryEditorOutput =
  | { kind: "photo"; blob: Blob }
  | { kind: "video"; file: File; thumbnail: Blob | null };

export type StoryEditorHandle = {
  /** Flattens the current background + every text box into the final shareable media. */
  export: () => Promise<StoryEditorOutput>;
};

function newBox(fontKey: StoryFontKey): TextBox {
  return {
    id: Math.random().toString(36).slice(2),
    text: "Tap to edit",
    xPct: 50,
    yPct: 50,
    widthPct: 70,
    fontKey,
    color: "#ffffff",
    align: "center",
    bgColor: null,
    bgOpacity: 0.6,
    borderColor: null,
    sizePct: 6,
  };
}

/** A pinch (2-finger) in progress resizes the box; a single finger moves it, offset from wherever on the box it first touched down so the box never jumps to re-center under the finger. */
type Gesture = {
  boxId: string;
  pointers: Map<number, { x: number; y: number }>;
  grabOffsetPx: { x: number; y: number };
  startWidthPct: number;
  startDist: number | null;
};

function AlignIcon({ align }: { align: TextAlign }) {
  const lines =
    align === "left"
      ? [
          [3, 3, 21],
          [3, 9, 15],
          [3, 15, 18],
          [3, 21, 12],
        ]
      : align === "right"
        ? [
            [3, 3, 21],
            [9, 9, 21],
            [6, 15, 21],
            [12, 21, 21],
          ]
        : [
            [3, 3, 21],
            [6, 9, 18],
            [4.5, 15, 19.5],
            [7.5, 21, 16.5],
          ];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
      {lines.map(([x1, y, x2], i) => (
        <line key={i} x1={x1} y1={y} x2={x2} y2={y} />
      ))}
    </svg>
  );
}

/** Tracks how much the on-screen keyboard currently covers, via the VisualViewport API, so a toolbar that needs to stay reachable while typing can shift itself clear of it. Not every browser updates `visualViewport` on keyboard show/hide (notably older Safari), so this degrades to "no offset" there rather than breaking anything. */
function useKeyboardOffset(active: boolean): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) {
      setOffset(0);
      return;
    }
    function update() {
      if (!vv) return;
      setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return offset;
}

export const StoryEditor = forwardRef<StoryEditorHandle, { base: StoryBase }>(function StoryEditor(
  { base },
  ref
) {
  const [backgroundColor, setBackgroundColor] = useState<string>(STORY_BACKGROUND_COLORS[0]);
  const [boxes, setBoxes] = useState<TextBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  // Lit up while a single-finger drag has the box's center within
  // SNAP_THRESHOLD_PCT of the canvas's own horizontal/vertical center —
  // the matching guide line (rendered in the preview) is the visible
  // "yes, this is centered" confirmation.
  const [guide, setGuide] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  const previewRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const mediaUrl = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const keyboardOffset = useKeyboardOffset(!!editingId);

  useEffect(() => {
    ensureStoryFontsLoaded().then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (editingId && textareaRef.current) autoGrow(textareaRef.current);
  }, [editingId]);

  useEffect(() => {
    if (base.kind === "color") return;
    const url = URL.createObjectURL(base.file);
    mediaUrl.current = url;
    return () => URL.revokeObjectURL(url);
    // base identity only changes if the parent swaps the file entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.kind === "color" ? null : base.file]);

  const selected = boxes.find((b) => b.id === selectedId) ?? null;

  function addBox() {
    const box = newBox("inter");
    setBoxes((prev) => [...prev, box]);
    setSelectedId(box.id);
    setEditingId(box.id);
  }

  function updateSelected(patch: Partial<TextBox>) {
    if (!selectedId) return;
    setBoxes((prev) => prev.map((b) => (b.id === selectedId ? { ...b, ...patch } : b)));
  }

  function removeSelected() {
    if (!selectedId) return;
    setBoxes((prev) => prev.filter((b) => b.id !== selectedId));
    setSelectedId(null);
    setEditingId(null);
  }

  function onBoxPointerDown(e: ReactPointerEvent<HTMLDivElement>, id: string) {
    e.stopPropagation();
    if (editingId === id) return; // typing — the textarea owns pointer events, not a drag/pinch
    setSelectedId(id);
    const container = previewRef.current;
    const box = boxes.find((b) => b.id === id);
    if (!container || !box) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    let g = gestureRef.current;
    if (!g || g.boxId !== id) {
      const rect = container.getBoundingClientRect();
      const boxCenterPx = { x: (box.xPct / 100) * rect.width, y: (box.yPct / 100) * rect.height };
      g = {
        boxId: id,
        pointers: new Map(),
        // The offset between where this finger first landed and the box's
        // actual center — preserved for the rest of the drag so the box
        // keeps that same relative grab point instead of snapping its
        // center under the finger the instant it moves.
        grabOffsetPx: { x: e.clientX - rect.left - boxCenterPx.x, y: e.clientY - rect.top - boxCenterPx.y },
        startWidthPct: box.widthPct,
        startDist: null,
      };
      gestureRef.current = g;
    }
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 2) {
      const [p1, p2] = [...g.pointers.values()];
      g.startDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      g.startWidthPct = box.widthPct;
    }
  }

  function onBoxPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    const container = previewRef.current;
    if (!g || !g.pointers.has(e.pointerId) || !container) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = container.getBoundingClientRect();

    // Two fingers down — resize, don't also move.
    if (g.pointers.size >= 2 && g.startDist) {
      const [p1, p2] = [...g.pointers.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const widthPct = Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, g.startWidthPct * (dist / g.startDist)));
      setBoxes((prev) => prev.map((b) => (b.id === g.boxId ? { ...b, widthPct } : b)));
      return;
    }

    const p = g.pointers.get(e.pointerId);
    if (!p) return;
    let xPct = ((p.x - rect.left - g.grabOffsetPx.x) / rect.width) * 100;
    let yPct = ((p.y - rect.top - g.grabOffsetPx.y) / rect.height) * 100;
    const nearCenterX = Math.abs(xPct - 50) < SNAP_THRESHOLD_PCT;
    const nearCenterY = Math.abs(yPct - 50) < SNAP_THRESHOLD_PCT;
    if (nearCenterX) xPct = 50;
    if (nearCenterY) yPct = 50;
    xPct = Math.min(96, Math.max(4, xPct));
    yPct = Math.min(96, Math.max(4, yPct));
    setGuide({ x: nearCenterX, y: nearCenterY });
    setBoxes((prev) => prev.map((b) => (b.id === g.boxId ? { ...b, xPct, yPct } : b)));
  }

  function onBoxPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g) return;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size === 0) {
      gestureRef.current = null;
      setGuide({ x: false, y: false });
    } else {
      // Dropped from a pinch back to one finger (or vice versa) — reset the
      // reference points from here rather than jumping using stale ones.
      const container = previewRef.current;
      const box = boxes.find((b) => b.id === g.boxId);
      if (container && box) {
        const rect = container.getBoundingClientRect();
        const boxCenterPx = { x: (box.xPct / 100) * rect.width, y: (box.yPct / 100) * rect.height };
        const [remaining] = [...g.pointers.values()];
        g.grabOffsetPx = { x: remaining.x - rect.left - boxCenterPx.x, y: remaining.y - rect.top - boxCenterPx.y };
        g.startWidthPct = box.widthPct;
      }
      g.startDist = null;
    }
  }

  useImperativeHandle(ref, () => ({
    async export() {
      await ensureStoryFontsLoaded();

      if (base.kind === "video") {
        return { kind: "video", ...(await exportVideo(base.file, boxes, setExportProgress)) };
      }

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_W;
      canvas.height = OUTPUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      if (base.kind === "photo") {
        const img = await loadImage(base.file);
        drawCover(ctx, img, OUTPUT_W, OUTPUT_H);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);
      }

      for (const box of boxes) drawTextBox(ctx, box, OUTPUT_W, OUTPUT_H);

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/jpeg", 0.92)
      );
      return { kind: "photo", blob };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }));

  return (
    <div className="flex h-full flex-col">
      <div
        ref={previewRef}
        className="relative mx-auto aspect-[9/16] h-full max-h-full touch-none overflow-hidden"
        onClick={() => {
          setSelectedId(null);
          setEditingId(null);
        }}
        style={base.kind === "color" ? { backgroundColor } : undefined}
      >
        {base.kind === "photo" && mediaUrl.current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl.current} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {base.kind === "video" && mediaUrl.current && (
          <video
            src={mediaUrl.current}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {boxes.map((box) => {
          const font = storyFontByKey(box.fontKey);
          const isEditing = editingId === box.id;
          return (
            <div
              key={box.id}
              onPointerDown={(e) => onBoxPointerDown(e, box.id)}
              onPointerMove={onBoxPointerMove}
              onPointerUp={onBoxPointerEnd}
              onPointerCancel={onBoxPointerEnd}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setSelectedId(box.id);
                setEditingId(box.id);
              }}
              // The box's own size/position never changes while editing — the
              // textarea inside it grows instead (see its own auto-height
              // effect below) — so the box always visibly expands with the
              // text rather than clipping or scrolling it out of view.
              className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap break-words px-2 py-1 ${
                isEditing ? "cursor-text" : "cursor-move"
              } ${selectedId === box.id ? "outline outline-2 outline-dashed outline-white/80" : ""}`}
              style={{
                left: `${box.xPct}%`,
                top: `${box.yPct}%`,
                width: `${box.widthPct}%`,
                textAlign: box.align,
                fontFamily: `"${font.family}"`,
                fontWeight: font.cssWeight,
                color: box.color,
                fontSize: `${box.sizePct}cqh`,
                backgroundColor: box.bgColor ? hexToRgba(box.bgColor, box.bgOpacity) : "transparent",
                border: box.borderColor ? `2px solid ${box.borderColor}` : "none",
                borderRadius: box.bgColor || box.borderColor ? 6 : 0,
              }}
            >
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={box.text}
                  onChange={(e) => {
                    updateSelected({ text: e.target.value });
                    autoGrow(e.target);
                  }}
                  onBlur={() => setEditingId(null)}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  rows={1}
                  className="block w-full appearance-none resize-none overflow-hidden border-none outline-none"
                  style={{
                    fontFamily: "inherit",
                    fontWeight: "inherit",
                    color: "inherit",
                    fontSize: "inherit",
                    textAlign: "inherit",
                    // globals.css sets a background on every textarea sitewide
                    // (for light/dark form visibility elsewhere) — that rule
                    // is unlayered CSS, so it beats bg-transparent regardless
                    // of specificity. An inline style is the only thing that
                    // outranks it, and this box needs to show whatever's
                    // behind it (color/photo/video), never a solid fill.
                    background: "transparent",
                  }}
                />
              ) : (
                box.text
              )}
            </div>
          );
        })}

        {guide.x && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-b2b-pink" />}
        {guide.y && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-b2b-pink" />}

        {/* cqh (container query units) needs a query container — the preview
            div itself is sized to the real 9:16 box, so its own height is
            the thing font-size should scale against. */}
        <style jsx>{`
          div[class*="relative mx-auto"] {
            container-type: size;
          }
        `}</style>

        {exporting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <p className="text-sm font-medium">Preparing your story…</p>
            {base.kind === "video" && (
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-b2b-pink transition-[width]"
                  style={{ width: `${Math.round(exportProgress * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={addBox}
          disabled={!fontsReady}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
        >
          Aa Add text
        </button>
      </div>

      {base.kind === "color" && !selected && (
        <div className="flex items-center justify-center gap-2 px-4 pb-2">
          {BG_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use background color ${color}`}
              onClick={() => setBackgroundColor(color)}
              className={`h-8 w-8 rounded-full border-2 ${backgroundColor === color ? "border-white" : "border-white/20"}`}
              style={{ backgroundColor: color }}
            />
          ))}
          <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white/20 text-xs text-white">
            +
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      )}

      {selected && (
        <div
          className="flex flex-col gap-2 border-t border-white/10 bg-b2b-ink px-4 py-3 transition-transform"
          style={{ transform: editingId === selected.id ? `translateY(-${keyboardOffset}px)` : undefined }}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/50">Font</span>
            {STORY_FONTS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => updateSelected({ fontKey: f.key })}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  selected.fontKey === f.key ? "bg-white text-b2b-ink" : "bg-white/10 text-white hover:bg-white/20"
                }`}
                style={{ fontFamily: `"${f.family}"`, fontWeight: f.cssWeight }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => updateSelected({ align: a })}
                  aria-label={`Align ${a}`}
                  aria-pressed={selected.align === a}
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    selected.align === a ? "bg-white text-b2b-ink" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <AlignIcon align={a} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateSelected({ sizePct: Math.max(2.5, selected.sizePct - 1) })}
                className="h-7 w-7 rounded-full bg-white/10 text-sm font-bold text-white hover:bg-white/20"
                aria-label="Smaller text"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => updateSelected({ sizePct: Math.min(16, selected.sizePct + 1) })}
                className="h-7 w-7 rounded-full bg-white/10 text-sm font-bold text-white hover:bg-white/20"
                aria-label="Bigger text"
              >
                +
              </button>
              <button
                type="button"
                onClick={removeSelected}
                aria-label="Delete text box"
                className="h-7 w-7 rounded-full bg-white/10 text-sm text-white hover:bg-red-500/60"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-white/50">Text</span>
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Text color ${color}`}
                onClick={() => updateSelected({ color })}
                className={`h-6 w-6 rounded-full border-2 ${selected.color === color ? "border-white" : "border-white/20"}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-white/50">Box</span>
            <button
              type="button"
              onClick={() => updateSelected({ bgColor: null })}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] text-white ${
                selected.bgColor === null ? "border-white" : "border-white/20"
              }`}
              style={{
                backgroundImage:
                  "linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.3) 75%)",
                backgroundSize: "6px 6px",
              }}
              aria-label="Transparent box background"
            >
              ∅
            </button>
            {["#000000", "#ffffff", "#b8842a"].map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Box background ${color}`}
                onClick={() => updateSelected({ bgColor: color })}
                className={`h-6 w-6 rounded-full border-2 ${selected.bgColor === color ? "border-white" : "border-white/20"}`}
                style={{ backgroundColor: color }}
              />
            ))}
            {selected.bgColor && (
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={selected.bgOpacity}
                onChange={(e) => updateSelected({ bgOpacity: Number(e.target.value) })}
                className="ml-1 w-16"
                aria-label="Box background opacity"
              />
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-white/50">Border</span>
            <button
              type="button"
              onClick={() => updateSelected({ borderColor: null })}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] text-white ${
                selected.borderColor === null ? "border-white" : "border-white/20"
              }`}
              style={{
                backgroundImage:
                  "linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.3) 75%)",
                backgroundSize: "6px 6px",
              }}
              aria-label="No border"
            >
              ∅
            </button>
            {BORDER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Border color ${color}`}
                onClick={() => updateSelected({ borderColor: color })}
                className={`h-6 w-6 rounded-full border-2 ${selected.borderColor === color ? "border-white" : "border-white/20"}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/** Grows a textarea's own height to fit its content — the box around it has no fixed height of its own, so this is what actually makes the box "expand with the text" as lines are typed or wrapped. */
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = URL.createObjectURL(file);
  });
}

/** Draws `source` onto the canvas with CSS object-fit: cover semantics — works for either a decoded <img> or the current frame of a <video>. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  w: number,
  h: number
) {
  const sourceW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const sourceH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  const imgRatio = sourceW / sourceH;
  const boxRatio = w / h;
  let sx = 0,
    sy = 0,
    sw = sourceW,
    sh = sourceH;
  if (imgRatio > boxRatio) {
    sw = sourceH * boxRatio;
    sx = (sourceW - sw) / 2;
  } else {
    sh = sourceW / boxRatio;
    sy = (sourceH - sh) / 2;
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
}

function drawTextBox(ctx: CanvasRenderingContext2D, box: TextBox, outputW: number, outputH: number) {
  const font = storyFontByKey(box.fontKey);
  const fontSizePx = (box.sizePct / 100) * outputH;
  ctx.font = `${font.cssWeight} ${fontSizePx}px "${font.family}"`;
  ctx.textBaseline = "middle";

  const cx = (box.xPct / 100) * outputW;
  const cy = (box.yPct / 100) * outputH;
  const boxWidthPx = (box.widthPct / 100) * outputW;
  const padX = fontSizePx * 0.3;
  const padY = fontSizePx * 0.2;
  const lines = wrapText(ctx, box.text, Math.max(10, boxWidthPx - padX * 2));
  const lineHeight = fontSizePx * 1.2;
  const totalHeight = lines.length * lineHeight;

  // The background/border frame always matches the box's own set width —
  // not just however wide the longest line happens to be — same as what's
  // shown live, and the whole reason a border has a box to sit around.
  const rectX = cx - boxWidthPx / 2;
  const rectY = cy - totalHeight / 2 - padY;
  const rectH = totalHeight + padY * 2;

  if (box.bgColor) {
    ctx.fillStyle = hexToRgba(box.bgColor, box.bgOpacity);
    roundRect(ctx, rectX, rectY, boxWidthPx, rectH, fontSizePx * 0.15);
    ctx.fill();
  }
  if (box.borderColor) {
    ctx.strokeStyle = box.borderColor;
    ctx.lineWidth = Math.max(2, fontSizePx * 0.03);
    roundRect(ctx, rectX, rectY, boxWidthPx, rectH, fontSizePx * 0.15);
    ctx.stroke();
  }

  ctx.fillStyle = box.color;
  ctx.textAlign = box.align;
  const textX = box.align === "left" ? rectX + padX : box.align === "right" ? rectX + boxWidthPx - padX : cx;
  lines.forEach((line, i) => {
    const y = cy - totalHeight / 2 + lineHeight * i + lineHeight / 2;
    ctx.fillText(line, textX, y);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Plays the source video through once while drawing each frame (plus every
 * text box) onto an offscreen canvas, recording that canvas as a new video —
 * there's no server-side video pipeline in this app (see src/lib/uploads.ts),
 * so burning text into a video has to happen entirely client-side. Output is
 * webm (MediaRecorder's only broadly-supported format without a transcode
 * step) — see the caller for how that's surfaced to the user.
 */
async function exportVideo(
  file: File,
  boxes: TextBox[],
  onProgress: (fraction: number) => void
): Promise<{ file: File; thumbnail: Blob | null }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = false;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not read video"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_W;
  canvas.height = OUTPUT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const canvasStream = canvas.captureStream(30);
  // Best-effort audio passthrough — supported in Chromium-based browsers,
  // not universally (notably older Safari); the export still works, just
  // silently without audio, where it isn't.
  let combined: MediaStream = canvasStream;
  try {
    const videoWithCapture = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    const audioTracks = videoWithCapture.captureStream?.().getAudioTracks() ?? [];
    if (audioTracks.length > 0) {
      combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
    }
  } catch {
    // fall through with video-only stream
  }

  const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) =>
    MediaRecorder.isTypeSupported(t)
  );
  const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let thumbnail: Blob | null = null;

  const recordingDone = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  await new Promise<void>((resolve, reject) => {
    video.onended = () => resolve();
    video.onerror = () => reject(new Error("Playback failed during export"));
    video.currentTime = 0;
    video.play().catch(reject);

    let rafId: number;
    const drawFrame = () => {
      drawCover(ctx, video, OUTPUT_W, OUTPUT_H);
      for (const box of boxes) drawTextBox(ctx, box, OUTPUT_W, OUTPUT_H);
      if (!thumbnail && video.currentTime > 0.05) {
        canvas.toBlob((b) => (thumbnail = b), "image/jpeg", 0.8);
      }
      onProgress(video.duration ? Math.min(1, video.currentTime / video.duration) : 0);
      if (!video.ended) rafId = requestAnimationFrame(drawFrame);
    };
    rafId = requestAnimationFrame(drawFrame);
    video.onended = () => {
      cancelAnimationFrame(rafId);
      resolve();
    };
  });

  recorder.stop();
  await recordingDone;
  URL.revokeObjectURL(url);

  const blob = new Blob(chunks, { type: mimeType ?? "video/webm" });
  return { file: new File([blob], "story.webm", { type: blob.type }), thumbnail };
}
