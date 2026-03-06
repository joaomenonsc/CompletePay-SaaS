"use client";

import { useState } from "react";

import type { AxiosError } from "axios";
import { Loader2, Plus, QrCode, RefreshCw, Settings, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAccounts, useCreateAccount, useDeleteAccount, useQRCode, useSyncStatus } from "@/hooks/use-whatsapp";
import type { WAAccount, WAAccountCreate } from "@/types/whatsapp";

// ── Status indicator ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  connected: {
    dot: "bg-emerald-500",
    pulse: "animate-pulse",
    label: "Conectado",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  },
  disconnected: {
    dot: "bg-rose-500",
    pulse: "",
    label: "Desconectado",
    badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400",
  },
  pending: {
    dot: "bg-amber-500",
    pulse: "animate-pulse",
    label: "Pendente",
    badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  error: {
    dot: "bg-rose-600",
    pulse: "",
    label: "Erro",
    badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400",
  },
} as const;

function AccountStatusBadge({ status }: { status: WAAccount["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.badge}`}
    >
      <span className={`size-1.5 rounded-full ${cfg.dot} ${cfg.pulse}`} />
      {cfg.label}
    </span>
  );
}

function QRCodeDialog({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const { data: qr, isLoading } = useQRCode(accountId, open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="mr-1.5 size-3.5" />
          QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code de conexão</DialogTitle>
          <DialogDescription>Escaneie o código com o WhatsApp para vincular esta conta.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-6">
          {isLoading ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : qr?.qrcode_base64 ? (
            <>
              {/* biome-ignore lint/a11y/useAltText: QR code display */}
              <img
                src={`data:image/png;base64,${qr.qrcode_base64}`}
                width={256}
                height={256}
                className="rounded-lg border"
              />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Escaneie com o WhatsApp para conectar a conta.
              </p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {qr?.status === "pending" ? "Gerando QR Code..." : qr?.message || "QR Code não disponível."}
              </p>
              {qr?.status === "pending" && (
                <div className="mt-4">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsAppConfiguracoesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<WAAccountCreate>({
    display_name: "",
    phone_number: "",
    provider: "evolution",
    is_default: false,
  });

  const { data, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const syncStatus = useSyncStatus();

  const accounts = data?.items ?? [];

  const handleCreate = async () => {
    setCreateError(null);
    if (!form.display_name || !form.phone_number) {
      const msg = "Nome e telefone são obrigatórios.";
      setCreateError(msg);
      toast.error(msg);
      return;
    }
    try {
      await createAccount.mutateAsync(form);
      toast.success("Conta criada com sucesso!");
      setCreateOpen(false);
      setForm({
        display_name: "",
        phone_number: "",
        provider: "evolution",
        is_default: false,
      });
      setCreateError(null);
    } catch (e) {
      const err = e as AxiosError<{ detail?: string | string[] }>;
      const detail = err.response?.data?.detail;
      const detailMsg = Array.isArray(detail) ? detail.join(", ") : detail;
      const msg = detailMsg || err.message || "Erro ao criar conta.";
      setCreateError(msg);
      toast.error(`Erro: ${msg}`);
      console.error("Falha ao criar conta WhatsApp", err);
    }
  };

  return (
    <main className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Configurações WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Gerencie contas e configurações do módulo WhatsApp.</p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreateError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Adicionar conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova conta WhatsApp</DialogTitle>
              <DialogDescription>
                Informe nome e telefone. A configuração técnica é feita automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Nome de exibição *</Label>
                <Input
                  placeholder="ex: Clínica Principal"
                  value={form.display_name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      display_name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone (com DDI) *</Label>
                <Input
                  placeholder="+5511999999999"
                  value={form.phone_number}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone_number: e.target.value,
                    })
                  }
                />
              </div>
              {createError && <p className="text-destructive text-sm">{createError}</p>}
              <div className="flex items-center gap-2">
                <Switch
                  id="is_default"
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm({ ...form, is_default: v })}
                />
                <Label htmlFor="is_default" className="cursor-pointer">
                  Conta padrão da organização
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleCreate} disabled={createAccount.isPending}>
                {createAccount.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 size-4" />
                )}
                Adicionar conta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {/* Lista de contas */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Settings className="mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">Nenhuma conta configurada</p>
          <p className="mt-1 text-xs text-muted-foreground">Adicione uma conta WhatsApp para começar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((acc) => (
            <Card key={acc.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{acc.display_name}</CardTitle>
                      <AccountStatusBadge status={acc.status} />
                      {acc.is_default && (
                        <Badge variant="outline" className="text-xs">
                          <Star className="mr-1 size-2.5 fill-current" />
                          Padrão
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{acc.phone_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      title="Sincronizar status"
                      disabled={syncStatus.isPending}
                      onClick={() => syncStatus.mutate(acc.id)}
                    >
                      {syncStatus.isPending && syncStatus.variables === acc.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                    </Button>
                    {acc.provider === "evolution" && <QRCodeDialog accountId={acc.id} />}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      disabled={deleteAccount.isPending}
                      onClick={() =>
                        deleteAccount.mutate(acc.id, {
                          onSuccess: () => toast.success("Conta removida"),
                          onError: (e) => toast.error(`Erro: ${(e as Error).message}`),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
