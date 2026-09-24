// A no-op until NEXT_PUBLIC_SENTRY_DSN is set (see .env.example) — the
// dynamic import means the Sentry client SDK is never even fetched by the
// browser when it's unconfigured, so this costs unconfigured users nothing.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  });
}
