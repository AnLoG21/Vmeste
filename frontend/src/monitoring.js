let sentryReady = false;

export function initMonitoring() {
  const dsn = (import.meta.env.VITE_SENTRY_DSN || "").trim();
  if (!dsn) return;

  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.05,
        sendDefaultPii: false,
      });
      sentryReady = true;
    })
    .catch((err) => {
      console.warn("Sentry init failed", err);
    });
}

export function reportClientError(error, context = {}) {
  if (!error) return;
  console.error(error, context);
  if (!sentryReady) return;
  void import("@sentry/react").then((Sentry) => {
    Sentry.captureException(error, { extra: context });
  });
}
