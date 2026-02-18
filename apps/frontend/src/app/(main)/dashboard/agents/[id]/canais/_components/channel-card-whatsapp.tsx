"use client";

import { useState } from "react";

import { Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ChannelCardWhatsApp() {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState("");
  const linkedNumber = "--";

  const handleConnect = () => {
    if (!token.trim()) {
      toast.error("Informe o token de acesso");
      return;
    }
    toast.success("Conexão em desenvolvimento");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
            <Smartphone className="size-5" />
          </div>
          <div>
            <CardTitle>WhatsApp Business</CardTitle>
            <p className="text-muted-foreground text-sm">Status: {enabled ? "Conectado" : "Não Conectado"}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">Para conectar o WhatsApp Business:</p>
        <ol className="list-inside list-decimal space-y-1 text-muted-foreground text-sm">
          <li>Tenha uma conta WhatsApp Business API ativa</li>
          <li>Escaneie o QR code ou insira o token de acesso</li>
        </ol>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex aspect-square w-40 shrink-0 items-center justify-center rounded-lg border-2 border-dashed bg-muted">
            <span className="text-center text-muted-foreground text-xs">QR Code</span>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-muted-foreground text-sm">ou</span>
            <Label htmlFor="wa-token" className="text-xs">
              Token de Acesso:
            </Label>
            <Input
              id="wa-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole o token aqui"
              className="font-mono text-sm"
            />
            <Button size="sm" onClick={handleConnect}>
              Conectar
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Número vinculado: <span className="font-medium text-foreground">{linkedNumber}</span>
        </p>
      </CardContent>
    </Card>
  );
}
