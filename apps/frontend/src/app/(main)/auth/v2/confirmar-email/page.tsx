"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { confirmEmail } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

import { Button } from "@/components/ui/button";

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const setToken = useAuthStore((s) => s.setToken);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token?.trim()) {
      setStatus("error");
      setMessage("Link inválido. Use o link que enviamos no seu email.");
      return;
    }
    confirmEmail(token)
      .then((res) => {
        setToken(res.access_token);
        setStatus("success");
        setMessage("Conta confirmada! Redirecionando…");
        window.location.href = "/dashboard";
      })
      .catch((err: unknown) => {
        setStatus("error");
        const detail =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : null;
        setMessage(
          typeof detail === "string" ? detail : "Link inválido ou expirado. Solicite um novo email de confirmação."
        );
      });
  }, [searchParams, setToken]);

  if (status === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="font-medium text-xl">Confirmando sua conta…</h1>
        <p className="text-muted-foreground text-sm">Aguarde um momento.</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="font-medium text-xl">Conta confirmada</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
        <Button asChild>
          <Link href="/dashboard">Ir para o dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <h1 className="font-medium text-xl">Falha na confirmação</h1>
      <p className="text-muted-foreground text-sm">{message}</p>
      <div className="flex flex-col gap-2">
        <Button asChild>
          <Link href="/auth/v2/login">Fazer login</Link>
        </Button>
        <Button asChild variant="link" className="text-muted-foreground text-sm">
          <Link href="/auth/v2/register">Criar nova conta</Link>
        </Button>
      </div>
    </div>
  );
}

export default function ConfirmarEmailPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
            <h1 className="font-medium text-xl">Confirmando sua conta…</h1>
          </div>
        }
      >
        <ConfirmEmailContent />
      </Suspense>
    </div>
  );
}
