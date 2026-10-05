import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Self-hosted (Railway via `next start`, not Vercel) — Next's built-in
    // image optimizer needs `sharp` at runtime, which is only an optional
    // dependency of Next itself and isn't guaranteed to install on every
    // build machine. Serving files unoptimized removes that failure mode
    // entirely; images here are small logos/user photos, not a scale where
    // server-side resizing matters.
    unoptimized: true,
  },
  experimental: {
    // Every request — including file uploads to our own API routes — passes
    // through src/middleware.ts (the site-password gate + auth check), and
    // Next silently truncates the body of any request that goes through
    // middleware to 10MB by default, which corrupts the multipart body
    // before our route handler ever sees it (surfaces as a generic "Invalid
    // request body" once the truncated body fails to parse). That 10MB cap
    // is well under what this app already allows per upload (a 150MB video,
    // or several photos in one post), so it needs raising here explicitly.
    middlewareClientMaxBodySize: 200 * 1024 * 1024, // 200MB
  },
};

// Wrapping is a no-op until SENTRY_DSN is set (see src/instrumentation.ts) —
// skipped entirely otherwise so an unconfigured Sentry account can never
// affect the build.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, { silent: true, disableLogger: true })
  : nextConfig;
