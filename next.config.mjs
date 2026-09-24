/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Uploads are already resized/compressed once, at upload time (see
    // src/lib/mediaProcessing.ts), so Next's per-request image optimizer
    // would only add CPU load on this self-hosted (Railway `next start`)
    // server for no real saving.
    unoptimized: true,
  },
  // Native binaries used by the upload pipeline — load them from
  // node_modules at runtime rather than bundling them.
  serverExternalPackages: ["sharp", "ffmpeg-static"],
  experimental: {
    // Every request passes through middleware (the site-password/auth gate),
    // and Next only buffers the first 10MB of a body for it by default —
    // anything past that is silently dropped, so a typical 15s phone video
    // (20–45MB) arrived truncated and failed as "Invalid request body".
    // Matches MAX_VIDEO_BYTES in src/lib/uploads.ts, plus form overhead.
    middlewareClientMaxBodySize: "160mb",
  },
};

export default nextConfig;
