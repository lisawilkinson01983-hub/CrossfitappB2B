// A no-op until SENTRY_DSN is set (see .env.example) — nothing about error
// monitoring is required to run the app locally or deploy it. Both hooks use
// a dynamic import so the SDK is never pulled into the middleware/server
// bundle at all when it's unconfigured.
export async function register() {
  // Push delivery (src/lib/pushDelivery.ts) needs Node's http2, so it's
  // loaded here — server start-up, Node runtime only — and handed to the
  // Prisma hook in src/lib/prisma.ts, rather than imported by prisma.ts,
  // which client bundles can reach.
  if (process.env.NEXT_RUNTIME === "nodejs" && (process.env.APNS_KEY || process.env.FCM_SERVICE_ACCOUNT)) {
    const { deliverPendingPushes } = await import("./lib/pushDelivery");
    (globalThis as { __b2bDeliverPushes?: () => Promise<void> }).__b2bDeliverPushes = deliverPendingPushes;
  }

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
