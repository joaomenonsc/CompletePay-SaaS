"use client";

import { useState } from "react";

import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ChannelCardEmail() {
  const [enabled, setEnabled] = useState(false);
  const [inboxEmail, setInboxEmail] = useState("suporte@completepay.com");
  const [imapServer, setImapServer] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [smtpServer, setSmtpServer] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");

  const handleTestConnection = () => {
    toast.info("Teste de conexão em desenvolvimento");
  };

  const handleSave = () => {
    toast.success("Configuração salva");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
            <Mail className="size-5" />
          </div>
          <div>
            <CardTitle>Email</CardTitle>
            <p className="text-muted-foreground text-sm">Status: {enabled ? "Configurado" : "Não Configurado"}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="inbox-email" className="text-sm">
            Email de Entrada (inbox dedicado):
          </Label>
          <Input
            id="inbox-email"
            value={inboxEmail}
            onChange={(e) => setInboxEmail(e.target.value)}
            placeholder="suporte@completepay.com"
            className="max-w-sm"
          />
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Configuração IMAP/SMTP:</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="imap-server" className="text-xs">
                Servidor IMAP:
              </Label>
              <Input
                id="imap-server"
                value={imapServer}
                onChange={(e) => setImapServer(e.target.value)}
                placeholder="imap.gmail.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="imap-port" className="text-xs">
                Porta:
              </Label>
              <Input
                id="imap-port"
                value={imapPort}
                onChange={(e) => setImapPort(e.target.value)}
                placeholder="993"
                className="w-20"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtp-server" className="text-xs">
                Servidor SMTP:
              </Label>
              <Input
                id="smtp-server"
                value={smtpServer}
                onChange={(e) => setSmtpServer(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtp-port" className="text-xs">
                Porta:
              </Label>
              <Input
                id="smtp-port"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-20"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-user" className="text-xs">
              Usuário:
            </Label>
            <Input id="email-user" value={user} onChange={(e) => setUser(e.target.value)} placeholder="seu@email.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-password" className="text-xs">
              Senha:
            </Label>
            <Input
              id="email-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestConnection}>
            Testar Conexão
          </Button>
          <Button size="sm" onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
