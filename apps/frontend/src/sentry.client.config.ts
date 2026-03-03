/**
 * Inicialização do Sentry no cliente (Fase 3.2 – Observabilidade).
 * Só ativa quando NEXT_PUBLIC_SENTRY_DSN estiver definido.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations: [
      // Core Web Vitals: captura INP (Interaction to Next Paint) — Onda 3.2
      Sentry.browserTracingIntegration({
        enableInp: true,
      }),
    ],
  });
}
