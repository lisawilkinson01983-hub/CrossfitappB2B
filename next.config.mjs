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
};

// Wrapping is a no-op until SENTRY_DSN is set (see src/instrumentation.ts) —
// skipped entirely otherwise so an unconfigured Sentry account can never
// affect the build.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, { silent: true, disableLogger: true })
  : nextConfig;
