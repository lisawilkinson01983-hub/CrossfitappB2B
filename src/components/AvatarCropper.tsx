"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function cropToBlob(imageSrc: string, area: Area, outputWidth: number, outputHeight: number): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputWidth, outputHeight);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image"))),
      "image/jpeg",
      0.9
    );
  });
}

/**
 * A full-screen modal for repositioning and zooming a just-selected photo
 * into a fixed frame before it's uploaded — opened instead of uploading the
 * raw file as-is, which would leave the crop entirely up to the browser's
 * always-centered `object-cover` and could cut off the important part of a
 * non-matching-aspect photo. Used both for the round 1:1 profile photo and
 * the wide rectangular profile banner (see EditProfileForm) and the round
 * group-chat photo (see GroupHeader) — aspect/shape/output size are the only
 * things that differ between them.
 */
export function AvatarCropper({
  imageSrc,
  onCancel,
  onCropped,
  aspect = 1,
  cropShape = "round",
  outputWidth = 512,
  outputHeight = 512,
}: {
  imageSrc: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  aspect?: number;
  cropShape?: "round" | "rect";
  outputWidth?: number;
  outputHeight?: number;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    setError(null);
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels, outputWidth, outputHeight);
      onCropped(blob);
    } catch {
      setError("Couldn't process that image. Please try a different one.");
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      <p className="mb-3 text-center text-sm text-white/70">Drag to reposition, pinch or use the slider to zoom</p>
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
        />
      </div>

      <div className="mx-auto mt-4 flex w-full max-w-sm flex-col gap-3">
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
