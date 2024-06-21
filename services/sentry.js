const Sentry = require("@sentry/node");
const { ProfilingIntegration } = require("@sentry/profiling-node");

if (process.env.ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_KEY,
    environment: process.env.MACHINE_TYPE || "PROD",
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new ProfilingIntegration(),
    ],
  });
}
module.exports = { Sentry };
