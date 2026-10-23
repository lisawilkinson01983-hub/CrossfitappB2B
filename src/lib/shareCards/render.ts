import { ImageResponse } from "next/og";
import { loadShareCardFonts } from "./fonts";
import { CARD_WIDTH, CARD_HEIGHT } from "./templates";

/** Full share-image resolution — a clean 4x of the 270x480 mockups, landing at true 9:16 Instagram Story size. */
export const FULL_SCALE = 4; // 1080x1920
/** Small enough to load fast as a format-picker thumbnail, still sharp at the ~72x128 display size used there. */
export const THUMB_SCALE = 1.5; // 405x720

export async function renderShareCard(node: React.ReactNode, scale: number) {
  const fonts = await loadShareCardFonts();
  return new ImageResponse(node as React.ReactElement, {
    width: Math.round(CARD_WIDTH * scale),
    height: Math.round(CARD_HEIGHT * scale),
    fonts,
  });
}
