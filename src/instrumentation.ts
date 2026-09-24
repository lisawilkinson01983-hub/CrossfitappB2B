// A no-op until SENTRY_DSN is set (see .env.example) — nothing about error
// monitoring is required to run the app locally or deploy it. Both hooks use
// a dynamic import so the SDK is never pulled into the middleware/server
// bundle at all when it's unconfigured.
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
