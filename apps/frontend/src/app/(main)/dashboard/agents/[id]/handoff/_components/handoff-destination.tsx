"use client";

import { useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type DestinationType = "email" | "webhook" | "none";

export function HandoffDestination() {
  const [destination, setDestination] = useState<DestinationType>("email");
  const [email, setEmail] = useState("suporte@completepay.com");
  const [webhookUrl, setWebhookUrl] = useState("https://api.example.com/handoff");

  const handleSave = () => {
    toast.success("Alterações salvas");
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Destino da Escalação</h3>
      <p className="text-muted-foreground text-sm">Quando escalar, para onde enviar?</p>
      <RadioGroup
        value={destination}
        onValueChange={(v) => setDestination(v as DestinationType)}
        className="grid gap-4"
      >
        <div className="flex items-start gap-3">
          <RadioGroupItem value="email" id="dest-email" />
          <div className="grid flex-1 gap-2">
            <Label htmlFor="dest-email" className="cursor-pointer font-normal">
              Email para equipe:
            </Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="suporte@completepay.com"
              className="max-w-sm"
              disabled={destination !== "email"}
            />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <RadioGroupItem value="webhook" id="dest-webhook" />
          <div className="grid flex-1 gap-2">
            <Label htmlFor="dest-webhook" className="cursor-pointer font-normal">
              Webhook (integração com CRM/helpdesk):
            </Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.example.com/handoff"
              className="font-mono text-sm"
              disabled={destination !== "webhook"}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem value="none" id="dest-none" />
          <Label htmlFor="dest-none" className="cursor-pointer font-normal">
            Nenhum (apenas informar usuário que não há humano disponível)
          </Label>
        </div>
      </RadioGroup>
      <Button onClick={handleSave}>Salvar Alterações</Button>
    </div>
  );
}
