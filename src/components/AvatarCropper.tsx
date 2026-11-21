"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area, type Size } from "react-easy-crop";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function cropToBlob(
  imageSrc: string,
  area: Area,
  outputWidth: number,
  outputHeight: number,
  cssFilter: string
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  // Baking the same CSS filter string used for the live preview into the
  // canvas draw (rather than, say, manipulating pixels) keeps the preview
  // and the exported file identical, and canvas 2D's `filter` accepts the
  // exact same syntax so there's nothing to translate.
  ctx.filter = cssFilter || "none";
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputWidth, outputHeight);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image"))),
      "image/jpeg",
      0.9
    );
  });
}

type FilterPreset = { key: string; name: string; filter: string };

const FILTER_PRESETS: FilterPreset[] = [
  { key: "none", name: "Original", filter: "" },
  { key: "vivid", name: "Vivid", filter: "saturate(1.55) contrast(1.12)" },
  { key: "warm", name: "Warm", filter: "sepia(0.25) saturate(1.3) hue-rotate(-8deg) brightness(1.05)" },
  { key: "cool", name: "Cool", filter: "hue-rotate(10deg) saturate(1.08) brightness(1.02) contrast(1.05)" },
  { key: "fade", name: "Fade", filter: "contrast(0.82) brightness(1.12) saturate(0.65)" },
  { key: "mono", name: "Mono", filter: "grayscale(1) contrast(1.08)" },
  { key: "noir", name: "Noir", filter: "grayscale(1) contrast(1.35) brightness(0.9)" },
];

/**
 * A full-screen modal for repositioning and zooming a just-selected photo
 * into a fixed frame before it's uploaded — opened instead of uploading the
 * raw file as-is, which would leave the crop entirely up to the browser's
 * always-centered `object-cover` and could cut off the important part of a
 * non-matching-aspect photo. Used both for the round 1:1 profile photo and
 * the wide rectangular profile banner (see EditProfileForm) and the round
 * group-chat photo (see GroupHeader) — aspect/shape/output size are the only
 * things that differ between them.
 *
 * `enableFilters` additionally shows a "Filters" tab (preset looks plus
 * brightness/contrast/saturation) alongside the existing "Adjust" tab, for
 * call sites editing a photo someone's about to post rather than an avatar —
 * feed photos and story-template photo swaps.
 *
 * `textGuide` paints the real template text sits over on top of the crop
 * preview itself — for a full-bleed template like FeedStoryA/FeedPostA
 * (photo-highlight story and feed cards), the exported photo gets text
 * baked directly onto it, and there was previously no way to tell, while
 * repositioning/zooming, whether that text was about to land on someone's
 * face. Sized and positioned to exactly match react-easy-crop's own crop
 * rectangle (tracked via onCropSizeChange) so it lines up with what will
 * actually be kept.
 */
export function AvatarCropper({
  imageSrc,
  onCancel,
  onCropped,
  aspect = 1,
  cropShape = "round",
  outputWidth = 512,
  outputHeight = 512,
  enableFilters = false,
  textGuide,
}: {
  imageSrc: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  aspect?: number;
  cropShape?: "round" | "rect";
  outputWidth?: number;
  outputHeight?: number;
  enableFilters?: boolean;
  textGuide?: { gradient: string; bottomPercent: number; sidePercent: number };
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropSize, setCropSize] = useState<Size | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"adjust" | "filters">("adjust");
  const [presetKey, setPresetKey] = useState("none");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const cssFilter = useMemo(() => {
    const preset = FILTER_PRESETS.find((p) => p.key === presetKey)?.filter ?? "";
    const tuned = brightness !== 100 || contrast !== 100 || saturation !== 100;
    const tune = tuned ? `brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100})` : "";
    return [preset, tune].filter(Boolean).join(" ");
  }, [presetKey, brightness, contrast, saturation]);

  // The filter-preset row below shows the SAME source photo seven times
  // (once per preset swatch) to preview each look. Pointing all seven
  // straight at `imageSrc` means the browser decodes the full-resolution
  // original seven times over just to paint 48px swatches — on a phone,
  // especially one already holding several other full-size photos picked
  // for this same post in memory, that's enough decode/memory pressure for
  // mobile Safari to start silently failing to paint some of them (reported
  // as "the filters aren't appearing, only the crop"). A single small,
  // shared thumbnail removes that cost entirely; the real crop/export below
  // still reads the full-resolution `imageSrc` so output quality is unaffected.
  const [swatchSrc, setSwatchSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!enableFilters) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    loadImage(imageSrc)
      .then((image) => {
        if (cancelled) return;
        const size = 96;
        const side = Math.min(image.width, image.height);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
        canvas.toBlob(
          (blob) => {
            if (cancelled || !blob) return;
            objectUrl = URL.createObjectURL(blob);
            setSwatchSrc(objectUrl);
          },
          "image/jpeg",
          0.7
        );
      })
      .catch(() => {
        // Swatches fall back to the full image below — still correct, just
        // without the memory saving.
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageSrc, enableFilters]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function resetFineTune() {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  }

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    setError(null);
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels, outputWidth, outputHeight, cssFilter);
      onCropped(blob);
    } catch {
      setError("Couldn't process that image. Please try a different one.");
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      {enableFilters && (
        <div className="mx-auto mb-2 flex w-full max-w-sm gap-1.5">
          <button
            type="button"
            onClick={() => setTab("adjust")}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              tab === "adjust" ? "bg-white/15 text-white" : "text-white/50"
            }`}
          >
            Adjust
          </button>
          <button
            type="button"
            onClick={() => setTab("filters")}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              tab === "filters" ? "bg-white/15 text-white" : "text-white/50"
            }`}
          >
            Filters
          </button>
        </div>
      )}
      <p className="mb-3 text-center text-sm text-white/70">
        {tab === "filters" ? "Tap a look, then fine-tune below if you want" : "Drag to reposition, pinch or use the slider to zoom"}
      </p>
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={cropShape}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          onCropSizeChange={setCropSize}
          style={{ mediaStyle: cssFilter ? { filter: cssFilter } : undefined }}
        />
        {textGuide && cropSize && (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
            style={{ width: cropSize.width, height: cropSize.height }}
          >
            <div className="absolute inset-0" style={{ backgroundImage: textGuide.gradient }} />
            <div
              className="absolute flex flex-col gap-1"
              style={{
                left: `${textGuide.sidePercent}%`,
                right: `${textGuide.sidePercent}%`,
                bottom: `${textGuide.bottomPercent}%`,
              }}
            >
              <div className="h-[6px] w-[35%] rounded-sm bg-white/80" />
              <div className="h-4 w-[55%] rounded bg-white/90" />
              <div className="h-[5px] w-[70%] rounded-sm bg-white/50" />
            </div>
          </div>
        )}
      </div>
      {textGuide && (
        <p className="mx-auto mt-2 max-w-sm text-center text-xs text-white/50">
          The shaded area is roughly where your name and score will sit — keep faces clear of it.
        </p>
      )}

      <div className="mx-auto mt-4 flex w-full max-w-sm flex-col gap-3">
        {tab === "adjust" || !enableFilters ? (
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-full"
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setPresetKey(preset.key)}
                  className="flex shrink-0 flex-col items-center gap-1.5"
                >
                  <span
                    className={`block h-12 w-12 overflow-hidden rounded-xl border-2 ${
                      presetKey === preset.key ? "border-b2b-pink" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, filtered thumbnail */}
                    <img
                      src={swatchSrc ?? imageSrc}
                      alt=""
                      className="h-full w-full object-cover"
                      style={preset.filter ? { filter: preset.filter } : undefined}
                    />
                  </span>
                  <span className={`text-[11px] font-semibold ${presetKey === preset.key ? "text-white" : "text-white/55"}`}>
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-3">
              {([
                ["Brightness", brightness, setBrightness],
                ["Contrast", contrast, setContrast],
                ["Saturation", saturation, setSaturation],
              ] as const).map(([label, value, setValue]) => (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-white/70">
                    <span>{label}</span>
                    <span className="text-white/40">{value}%</span>
                  </div>
                  <input
                    type="range"
                    min={label === "Saturation" ? 0 : 60}
                    max={label === "Saturation" ? 180 : 140}
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    aria-label={label}
                    className="w-full"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={resetFineTune}
                className="self-start text-xs font-bold text-b2b-pink hover:text-b2b-pink-dark"
              >
                Reset fine-tune
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="flex-1 rounded bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!croppedAreaPixels || processing}
            className="flex-1 rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            {processing ? "Saving…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
