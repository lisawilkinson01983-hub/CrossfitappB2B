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
    const { syncBadge } = await import("./lib/push");
    (globalThis as { __b2bSyncBadge?: (userId: string) => Promise<void> }).__b2bSyncBadge = syncBadge;
  }

  // Event reminders (src/lib/eventReminders.ts): checked every 30 minutes
  // in this always-on server process, so no separate cron service is
  // needed. Guarded so dev-mode reloads don't stack up extra timers.
  const g = globalThis as { __b2bReminderTimer?: ReturnType<typeof setInterval> };
  if (process.env.NEXT_RUNTIME === "nodejs" && !g.__b2bReminderTimer) {
    const { sendEventReminders } = await import("./lib/eventReminders");
    const run = () => {
      sendEventReminders().catch((err) => console.error("[reminders] failed:", err));
    };
    g.__b2bReminderTimer = setInterval(run, 30 * 60 * 1000);
    g.__b2bReminderTimer.unref?.();
    setTimeout(run, 60 * 1000).unref?.(); // first check a minute after start-up
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
