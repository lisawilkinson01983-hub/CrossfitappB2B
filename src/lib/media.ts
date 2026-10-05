/** Shared between the client (composer) and server (upload validation). */
export const MAX_VIDEO_SECONDS = 20;

// Every photo gets resized down to 1600px/quality 82 on the server regardless
// of how it comes in (see resizePhoto in src/lib/uploads.ts), so this isn't
// protecting storage or bandwidth after the fact — it only needs to be high
// enough that a real phone camera photo (a modern phone's default JPEG
// routinely runs 6-10MB+, more on a high-megapixel sensor) doesn't get
// rejected outright. 5MB was too tight for that and caused an otherwise
// perfectly good multi-photo post to fail outright over one oversized photo.
export const MAX_PHOTO_MB = 15;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
