"use client";

import { useState } from "react";

import * as Sentry from "@sentry/nextjs";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SentryTestPage() {
  const [sent, setSent] = useState(false);

  const hasDsn = Boolean(typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN);

  const handleCaptureTest = () => {
    setSent(false);
    Sentry.captureException(new Error("Teste Sentry – erro de exemplo (pode ignorar)"));
    setSent(true);
  };

  const handleThrowError = () => {
    throw new Error("Teste Sentry – erro não capturado (testa boundary)");
  };

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Testar Sentry</CardTitle>
          <CardDescription>
            Use os botões abaixo para enviar um erro de teste ao Sentry e conferir se a integração está ativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasDsn && (
            <p className="rounded-md bg-amber-500/10 p-3 text-amber-800 text-sm dark:text-amber-200">
              NEXT_PUBLIC_SENTRY_DSN não está definido no .env. Configure o DSN e reinicie o dev server para testar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="default" onClick={handleCaptureTest} disabled={!hasDsn}>
              Enviar erro de teste (captureException)
            </Button>
            <Button type="button" variant="outline" onClick={handleThrowError} disabled={!hasDsn}>
              Lançar erro (testa tela de erro)
            </Button>
          </div>
          {sent && (
            <p className="text-emerald-600 text-sm dark:text-emerald-400">
              Erro de teste enviado. Confira em Sentry → Issues (pode levar alguns segundos).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
