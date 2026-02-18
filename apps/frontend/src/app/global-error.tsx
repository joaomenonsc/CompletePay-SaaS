"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";

/**
 * Captura erros de render do App Router e envia ao Sentry (Fase 3.2).
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <h2>Algo deu errado</h2>
          <p style={{ color: "#666", marginBottom: "1rem" }}>
            Ocorreu um erro inesperado. Nossa equipe foi notificada.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              cursor: "pointer",
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
