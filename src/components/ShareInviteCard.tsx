"use client";

import { useState } from "react";

// Standard vertical story size (Instagram/Facebook Stories, 9:16).
const WIDTH = 1080;
const HEIGHT = 1920;

const BRAND_PINK = "#eb4e94";
const BRAND_PURPLE = "#7a2fb8";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws left-to-right-wrapped, center-aligned text and returns the y position after the last line. */
function wrapCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  ctx.textAlign = "center";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, cx, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, cursorY);
  return cursorY;
}

async function renderInviteCard(name: string, photo: string | null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, BRAND_PINK);
  bg.addColorStop(1, BRAND_PURPLE);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.85, HEIGHT * 0.14, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(WIDTH * 0.12, HEIGHT * 0.9, 300, 0, Math.PI * 2);
  ctx.fill();

  // Logo mark: two interlocking rounded squares, matching the in-app Logo component.
  const markX = 100;
  const markY = 130;
  const markSize = 90;
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#ffffff";
  roundedRectPath(ctx, markX, markY, markSize, markSize, 18);
  ctx.stroke();
  roundedRectPath(ctx, markX + markSize * 0.5, markY + markSize * 0.5, markSize, markSize, 18);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = "700 58px Arial, sans-serif";
  ctx.fillText("BOX 2 BOX", markX + markSize * 1.5 + 24, markY + markSize + 10);

  // Athlete avatar, centered.
  const avatarSize = 300;
  const avatarX = WIDTH / 2 - avatarSize / 2;
  const avatarY = 560;
  const avatarCenterY = avatarY + avatarSize / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(WIDTH / 2, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (photo) {
    try {
      const img = await loadImage(photo);
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
    } catch {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "700 140px Arial, sans-serif";
    ctx.fillText(name.charAt(0).toUpperCase(), WIDTH / 2, avatarCenterY + 48);
  }
  ctx.restore();

  ctx.lineWidth = 10;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(WIDTH / 2, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 54px Arial, sans-serif";
  ctx.fillText(name, WIDTH / 2, avatarY + avatarSize + 90);

  ctx.font = "500 40px Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("I am on Box 2 Box", WIDTH / 2, avatarY + avatarSize + 150);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 92px Arial, sans-serif";
  const headlineEnd = wrapCenteredText(
    ctx,
    "CONNECT. SHARE. INSPIRE.",
    WIDTH / 2,
    avatarY + avatarSize + 270,
    WIDTH - 140,
    102
  );

  ctx.font = "500 42px Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  wrapCenteredText(
    ctx,
    "The social app for CrossFit athletes — log workouts, share PBs, find your people. Ask me for an invite!",
    WIDTH / 2,
    Math.max(headlineEnd + 100, HEIGHT - 300),
    WIDTH - 220,
    58
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to render image"));
    }, "image/png");
  });
}

export function ShareInviteCard({ name, photo }: { name: string; photo: string | null }) {
  const [open, setOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  async function handleOpen() {
    setOpen(true);
    setRendering(true);
    setError(null);
    try {
      const b = await renderInviteCard(name, photo);
      setBlob(b);
      setPreviewUrl(URL.createObjectURL(b));
    } catch {
      setError("Couldn't generate the invite card. Please try again.");
    } finally {
      setRendering(false);
    }
  }

  function handleClose() {
    setOpen(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
  }

  async function handleShare() {
    if (!blob) return;
    const file = new File([blob], "box2box-invite.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Join me on Box 2 Box",
          text: "Join me on Box 2 Box — the social app for CrossFit athletes!",
        });
      } catch {
        // User cancelled the share sheet — nothing to do.
      }
    }
  }

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-full border border-b2b-purple/20 px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink"
      >
        📣 Invite a friend
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4"
          onClick={handleClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full flex-col items-center gap-4"
          >
            {error ? (
              <p className="max-w-xs text-center text-sm text-white">{error}</p>
            ) : rendering || !previewUrl ? (
              <div className="flex aspect-[9/16] w-[260px] items-center justify-center rounded-2xl bg-white/10 text-sm text-white">
                Generating...
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Invite card preview"
                className="max-h-[70vh] rounded-2xl shadow-lg"
              />
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {canShareFiles && previewUrl && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="rounded-full bg-b2b-pink px-5 py-2 text-sm font-semibold text-white hover:bg-b2b-pink-dark"
                >
                  Share to Stories
                </button>
              )}
              {previewUrl && (
                <a
                  href={previewUrl}
                  download="box2box-invite.png"
                  className="rounded-full border border-white/40 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Download
                </a>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full px-5 py-2 text-sm font-medium text-white/70 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
